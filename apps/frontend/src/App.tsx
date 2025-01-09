import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Provider } from "@/components/ui/provider";
import { Button } from "./components/ui/button";
import {
  Badge,
  Center,
  Container,
  DialogCloseTrigger,
  Heading,
  HStack,
  Input,
  Link,
  LinkBox,
  LinkOverlay,
  Span,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { DataListItem, DataListRoot } from "@/components/ui/data-list";

import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "./components/ui/dialog";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  collection,
  doc,
  updateDoc,
  type Timestamp,
  query,
  where,
} from "firebase/firestore";
import { db, useDoc, useDocs } from "./services/firebase";
import { Field } from "./components/ui/field";
import { InputGroup } from "./components/ui/input-group";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Attendee = {
  id: string;
  name: string;
  phoneNumber: string;
};

type Event = {
  id: string;
  name: string;
  type: "cocktail" | "dinner" | "lan";
  startsAt: Timestamp;
  endsAt: Timestamp;
  rsvpBy: Timestamp;
  address: string;
  descriptionHTML: string;
};

function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const [attendees, isAttendeesLoading] = useDocs<Attendee>(
    collection(db, "events", event.id, "attendees"),
    true
  )

  return (
    <LinkBox
      key={event.id}
      as="article"
      maxW="sm"
      p="5"
      borderWidth="1px"
      rounded="md"
    >
      <Span asChild color="fg.muted" textStyle="sm">
        <time dateTime="2021-01-15 15:30:00 +0000 UTC">
          {format(event.startsAt.toDate(), "EEEE, MMM do 'at' h:mma")}
        </time>
      </Span>
      <Heading size="lg" my="2">
        <LinkOverlay
          href={`?event=${event.id}`}
          onClick={(ev) => {
            ev.preventDefault();
            onClick();
          }}
        >
          {event.name}
        </LinkOverlay>
      </Heading>
      <Text
        mb="3"
        color="fg.muted"
        dangerouslySetInnerHTML={{ __html: event.descriptionHTML }}
      ></Text>
      <Link
        href={`?event=${event.id}`}
        variant="underline"
        colorPalette="teal"
        onClick={(ev) => {
          ev.preventDefault();
          onClick();
        }}
      >
        RSVP{attendees.length > 0 && `with ${attendees.length} others`}
      </Link>
    </LinkBox>
  );
}

function UnknownAttendeeView() {
  return (
    <Container maxWidth="lg">
      <DialogRoot placement="center" open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who are you?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            We'd love for you to join us at our parties, but we need to know who
            you are first! Please ask Sarah or Frank for your special link to
            browse and RSVP for our events.
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </Container>
  );
}

function AttendeeView({ attendee }: { attendee: Attendee }) {
  const [eventType, setEventType] = useState<"all" | "cocktail" | "dinner" | "lan">("all");
  const memoizedQuery = useMemo(() => query(collection(db, "events"), where("type", "==", eventType)), [eventType]);
  const [events, isEventsLoading] = useDocs<Event>(memoizedQuery, true);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const handlePersonalInfoChangeTimeoutRef = useRef<number | null>(null);

  const [personalInfoState, setPersonalInfoState] = useState<
    "saved" | "waiting"
  >("saved");
  const [name, setName] = useState(attendee.name);
  const [phoneNumber, setPhoneNumber] = useState(attendee.phoneNumber);

  useEffect(() => {
    // Fetch active event from url params
    const urlSearchParams = new URLSearchParams(window.location.search);
    if (urlSearchParams.has("event")) {
      setActiveEventId(urlSearchParams.get("event"));
    }
  }, []);

  const handlePersonalInfoChange = useCallback(async () => {
    // Update attendee name and phone number in firestore
    await updateDoc(doc(collection(db, "attendees"), attendee.id), {
      name,
      phoneNumber,
    });
    console.log("Saved");
    setPersonalInfoState("saved");
  }, [attendee, name, phoneNumber]);

  useEffect(() => {
    if (name === attendee.name && phoneNumber === attendee.phoneNumber) {
      setPersonalInfoState("saved");
      return;
    }
    setPersonalInfoState("waiting");
    // Update attendee name and phone number in firestore
    if (handlePersonalInfoChangeTimeoutRef.current) {
      clearTimeout(handlePersonalInfoChangeTimeoutRef.current);
    }

    handlePersonalInfoChangeTimeoutRef.current = setTimeout(
      handlePersonalInfoChange,
      1500
    );

    return () => {
      if (handlePersonalInfoChangeTimeoutRef.current) {
        clearTimeout(handlePersonalInfoChangeTimeoutRef.current);
      }
    };
  }, [
    attendee.name,
    attendee.phoneNumber,
    handlePersonalInfoChange,
    name,
    phoneNumber,
  ]);

  function handleClearAttendee() {
    localStorage.removeItem("code");
    window.history.pushState({}, document.title, window.location.pathname);
    window.location.reload();
  }

  const activeEvent = events.find((event) => event.id === activeEventId);

  return (
    <Container maxWidth="breakpoint-md">
      <Heading size="6xl">Sarah and Frank's Parties</Heading>
      <Heading size="lg">
        Welcome, {attendee.name} ({attendee.phoneNumber})!{" "}
        <Button
          variant="ghost"
          onClick={() => setIsEditingPersonalInfo((prev) => !prev)}
        >
          Edit
        </Button>
        <Button variant="subtle" onClick={handleClearAttendee}>
          I'm not {attendee.name}
        </Button>
      </Heading>
      {isEditingPersonalInfo && (
        <HStack padding="4" backgroundColor="bg.panel" borderRadius="lg">
          <Field label="Name" helperText="In case we got it wrong" flex="1">
            <InputGroup
              flex="1"
              endElement={
                personalInfoState === "waiting" ? <Spinner size="sm" /> : null
              }
            >
              <Input
                autoComplete="name"
                defaultValue={attendee.name}
                onChange={(ev) => setName(ev.currentTarget.value.trim())}
              />
            </InputGroup>
          </Field>
          <Field
            label="Phone Number"
            helperText="So we can send you spam texts"
            flex="1"
          >
            <InputGroup
              flex="1"
              endElement={
                personalInfoState === "waiting" ? <Spinner size="sm" /> : null
              }
            >
              <Input
                autoComplete="tel"
                type="tel"
                defaultValue={attendee.phoneNumber}
                onChange={(ev) => setPhoneNumber(ev.currentTarget.value.trim())}
              />
            </InputGroup>
          </Field>
        </HStack>
      )}

      <section>
        <Heading size="xl">Upcoming Events</Heading>
        <SegmentedControl
          defaultValue="all"
          name="eventType"
          onValueChange={({ value }) => setEventType(value as Event["type"])}
          items={[
            {
              label: "All",
              value: "all",
            },
            {
              label: "Cocktail Parties",
              value: "cocktail",
            },
            {
              label: "Dinner Parties",
              value: "dinner",
            },
            {
              label: "LAN Parties",
              value: "lan",
            },
          ]}
        />

        <Stack>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => {
                setActiveEventId(event.id);
              }}
            />
          ))}
        </Stack>
      </section>

      {activeEvent && (
        <DialogRoot open onExitComplete={() => setActiveEventId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{activeEvent.name}</DialogTitle>
            </DialogHeader>
            <DialogBody pb="8">
              <DataListRoot orientation="horizontal">
                <DataListItem
                  label="Status"
                  value={<Badge colorPalette="green">Completed</Badge>}
                />
                <DataListItem
                  label="Starts"
                  value={`${format(
                    activeEvent.startsAt.toDate(),
                    "EEEE, MMM do 'at' h:mma"
                  )} (${formatDistanceToNowStrict(
                    activeEvent.startsAt.toDate(),
                    {
                      addSuffix: true,
                    }
                  )})`}
                />
                <DataListItem
                  label="RSVP by"
                  value={`${format(
                    activeEvent.rsvpBy.toDate(),
                    "EEEE, MMM do 'at' h:mma"
                  )} (${formatDistanceToNowStrict(activeEvent.rsvpBy.toDate(), {
                    addSuffix: true,
                  })})`}
                />
              </DataListRoot>

              <Textarea placeholder="Add a note" mt="8" minHeight={"10"} />
            </DialogBody>
            <DialogFooter>
              <Button variant="surface" colorPalette="purple">
                Save RSVP
              </Button>
              <Button
                variant="ghost"
                colorPalette="red"
                onClick={() => setActiveEventId(null)}
              >
                Close
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </DialogContent>
        </DialogRoot>
      )}
    </Container>
  );
}

/** Gets attendee ID either from url search params or localstorage. */
function getAttendeeId() {
  const urlSearchParams = new URLSearchParams(window.location.search);
  if (urlSearchParams.has("code")) {
    const code = urlSearchParams.get("code") as string;
    localStorage.setItem("attendeeId", atob(code));
    return atob(code);
  }

  return localStorage.getItem("attendeeId");
}

function App() {
  const attendeeId = getAttendeeId();
  const [attendee, isAttendeeLoading, attendeeError] = useDoc<Attendee>(
    doc(db, "attendees", attendeeId as string),
    !!attendeeId
  );

  useEffect(() => {
    if (attendeeError) {
      console.error(attendeeError);
    }
  });

  return (
    <Provider>
      {isAttendeeLoading ? (
        <Center>
          <Spinner size="xl" />
        </Center>
      ) : attendee ? (
        <AttendeeView attendee={attendee} />
      ) : (
        <UnknownAttendeeView />
      )}
    </Provider>
  );
}

export default App;

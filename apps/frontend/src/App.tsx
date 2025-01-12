import { useCallback, useEffect, useRef, useState } from "react";
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
  query,
  where,
  onSnapshot,
  setDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  type AttendeeDoc,
  db,
  type EventDoc,
} from "./services/firebase";
import { Field } from "./components/ui/field";
import { InputGroup } from "./components/ui/input-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "./components/ui/empty-state";
import { Prose } from "./components/ui/prose";

type EventType = {
  label: string;
  value: EventDoc["type"] | "all";
  description?: string;
}
const eventTypes: EventType[] = [
  {
    label: "All",
    value: "all",
    description: "All the parties. Wh"
  },
  {
    label: "🍸 Cocktail Parties",
    value: "cocktail",
    description: "The OG party. Join us for a night of drinks, snacks, and mingling. Meet new people and catch up with old friends.",
  },
  {
    label: "🍽️ Dinner Parties",
    value: "dinner",
    description: "Join us for longer, sit-down meals with a variety of cuisines and themes. Meet new people and enjoy a night of great food and conversation."
  },
  {
    label: "🎮 LAN Parties",
    value: "lan",
    description: "Bring your laptop (or desktop if you're a true gamer) and join us for video games ranging from casual to competitive."
  },
  {
    label: "🎲 Game Nights",
    value: "game",
    description: "Board games, card games, and party games. We are building a collection and are always looking for new players."
  },
  {
    label: "🍿 Movie Nights",
    value: "movie",
    description: "Grab some popcorn and squish in on our couch to watch a movie together. I paid too much for this stupid QLED TV not to use it."
  }
] as const;

function EventCard({
  event,
  onClick,
}: {
  event: EventDoc;
  onClick: (eventId: string) => void;
}) {
  const [attendees, setAttendees] = useState<AttendeeDoc[]>([]);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events", event.id, "attendees"),
      (querySnapshot) => {
        const attendees = querySnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as AttendeeDoc)
        );

        setAttendees(attendees);
      }
    );

    return unsubscribe;
  }, [event.id]);

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
            onClick(event.id);
          }}
        >
          {event.name}
        </LinkOverlay>
      </Heading>
      <Prose>
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{ __html: event.descriptionHTML }}
      />
      </Prose>
      
      <Link
        href={`?event=${event.id}`}
        variant="underline"
        colorPalette="teal"
        onClick={(ev) => {
          ev.preventDefault();
          onClick(event.id);
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

function streamEvents(
  eventType: "all" | "cocktail" | "dinner" | "lan",
  callback: (events: EventDoc[]) => void
) {
  const q =
    eventType === "all"
      ? collection(db, "events")
      : query(collection(db, "events"), where("type", "==", eventType));

  return onSnapshot(q, (querySnapshot) => {
    const events = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as EventDoc)
    );

    callback(events);
  });
}

function AttendeeContactInfo({ attendee }: { attendee: AttendeeDoc }) {
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const handlePersonalInfoChangeTimeoutRef = useRef<number | null>(null);

  const [personalInfoState, setPersonalInfoState] = useState<
    "saved" | "waiting"
  >("saved");
  const [name, setName] = useState(attendee.name);
  const [phoneNumber, setPhoneNumber] = useState(attendee.phoneNumber);

  function handleClearAttendee() {
    localStorage.removeItem("attendeeId");
    window.history.pushState({}, document.title, window.location.pathname);
    window.location.reload();
  }

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

  return (
    <>
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
    </>
  );
}

function AttendeeEventsView({ attendee }: { attendee: AttendeeDoc }) {
  const [eventType, setEventType] = useState<
    "all" | "cocktail" | "dinner" | "lan"
  >("all");

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = streamEvents(eventType, setEvents);
    return unsubscribe;
  }, [eventType]);

  useEffect(() => {
    // Fetch active event from url params
    const urlSearchParams = new URLSearchParams(window.location.search);
    if (urlSearchParams.has("event")) {
      setActiveEventId(urlSearchParams.get("event"));
    }
  }, []);

  async function handleRSVPToggle() {
    if (!activeEventId) {
      return;
    }

    const eventAttendeeDoc = await getDoc(
      doc(db, "events", activeEventId, "attendees", attendee.id)
    );
    if (eventAttendeeDoc.exists()) {
      await deleteDoc(eventAttendeeDoc.ref);
    } else {
      await setDoc(eventAttendeeDoc.ref, {
        attendee: doc(db, "attendees", attendee.id),
      });
    }
  }

  const activeEvent = events.find((event) => event.id === activeEventId);

  const [isRsvpedForActiveEvent, setIsRsvpedForActiveEvent] = useState(false);
  useEffect(() => {
    if (!activeEventId) {
      return;
    }

    const docRef = doc(db, "events", activeEventId, "attendees", attendee.id);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      setIsRsvpedForActiveEvent(doc.exists());
    });
    return unsubscribe;
  }, [activeEventId, attendee.id]);

  const eventTypeDescripion = eventTypes.find(
    (et) => et.value === eventType
  )?.description;

  return (
    <>
      <section>
        <Heading size="xl">Upcoming Events</Heading>
        <SegmentedControl
          defaultValue="all"
          name="eventType"
          onValueChange={({ value }) => setEventType(value as EventDoc["type"])}
          items={eventTypes}
        />
        {eventTypeDescripion && (
          <Text color="fg.muted" mb="4">
            {eventTypeDescripion}
          </Text>
        )}

        <Stack>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={setActiveEventId}
            />
          ))}
          {events.length === 0 && <EmptyState title="No Events Found" />}
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
              <Button
                variant="surface"
                colorPalette="purple"
                onClick={handleRSVPToggle}
              >
                {isRsvpedForActiveEvent ? "Un-RSVP" : "RSVP"}
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
    </>
  );
}

function AttendeeView({ attendee }: { attendee: AttendeeDoc }) {
  return (
    <Container maxWidth="breakpoint-md">
      <Heading size="6xl">Sarah and Frank's Parties</Heading>
      <AttendeeContactInfo attendee={attendee} />
      <AttendeeEventsView attendee={attendee} />
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
  const [attendee, setAttendee] = useState<AttendeeDoc | null>(null);
  const [isAttendeeLoading, setIsAttendeeLoading] = useState(true);

  useEffect(() => {
    const attendeeId = getAttendeeId();
    if (!attendeeId) {
      setIsAttendeeLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "attendees", attendeeId), (doc) => {
      if (doc.exists()) {
        setAttendee({
          id: doc.id,
          ...doc.data(),
        } as AttendeeDoc);
      } else {
        setAttendee(null);
      }
      setIsAttendeeLoading(false);
    });
    return unsubscribe;
  }, []);

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

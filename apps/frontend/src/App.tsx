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
  DialogTrigger,
} from "./components/ui/dialog";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type Timestamp,
} from "firebase/firestore/lite";
import { db } from "./services/firebase";
import { Field } from "./components/ui/field";
import { InputGroup } from "./components/ui/input-group";
import { Avatar } from "./components/ui/avatar";

type Attendee = {
  id: string;
  name: string;
  phoneNumber: string;
};

type Event = {
  id: string;
  name: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  rsvpBy: Timestamp;
  address: string;
  descriptionHTML: string;
};

async function getAttendeeFromCode(code: string): Promise<Attendee> {
  // Decode code as base64
  const id = atob(code);

  const attendeeCollection = collection(db, "attendees");
  // Get attendee from Firestore
  const attendeeDoc = await getDoc(doc(attendeeCollection, id));
  if (!attendeeDoc.exists()) {
    throw new Error("Attendee not found");
  }
  const attendee = attendeeDoc.data();

  if (!attendee) {
    throw new Error("Attendee not found");
  }

  return {
    id: attendeeDoc.id,
    name: attendee.name,
    phoneNumber: attendee.phoneNumber,
  };
}

async function getAttendeesForEvent(eventId: string) {
  const query = await getDocs(collection(db, "events", eventId, "attendees"));
  return query.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Attendee));
}

function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  useEffect(() => {
    // Fetch attendee count for event on firestore sub collection
    getAttendeesForEvent(event.id)
      .then((attendees) => {
        console.log(attendees);

        setAttendees(attendees);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [event]);

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
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const handlePersonalInfoChangeTimeoutRef = useRef<number | null>(null);

  const [personalInfoState, setPersonalInfoState] = useState<
    "saved" | "waiting"
  >("saved");
  const [name, setName] = useState(attendee.name);
  const [phoneNumber, setPhoneNumber] = useState(attendee.phoneNumber);

  useEffect(() => {
    // Fetch events from firestore
    const eventsCollection = collection(db, "events");
    getDocs(eventsCollection).then((querySnapshot) => {
      const events = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Event)
      );
      setEvents(events);
    });

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
                  )} (${formatDistanceToNowStrict(
                    activeEvent.rsvpBy.toDate(),
                    {
                      addSuffix: true,
                    }
                  )})`}
                />
              </DataListRoot>

              <Textarea placeholder="Add a note" mt="8" minHeight={"10"}/>
            </DialogBody>
            <DialogFooter>
              <Button variant="surface" colorPalette="purple">
                Save RSVP
              </Button>
              <Button variant="ghost" colorPalette="red" onClick={() => setActiveEventId(null)}>
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

function App() {
  const [isAttendeeLoading, setIsAttendeeLoading] = useState(true);
  const [attendee, setAttendee] = useState<Attendee | null>(null);

  useEffect(() => {
    // Check for user name and phone number in query or local storage
    const urlSearchParams = new URLSearchParams(window.location.search);
    let code: string | null = null;
    if (urlSearchParams.has("code")) {
      code = urlSearchParams.get("code");
    } else {
      code = localStorage.getItem("code");
    }

    if (code) {
      getAttendeeFromCode(code)
        .then((attendee) => {
          setAttendee(attendee);
          localStorage.setItem("code", code);
          const urlSearchParams = new URLSearchParams(window.location.search);
          // Remove code from url
          urlSearchParams.delete("code");

          window.history.pushState(
            {},
            document.title,
            `${window.location.pathname}?${urlSearchParams.toString()}`
          );
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setIsAttendeeLoading(false);
        });
    } else {
      setIsAttendeeLoading(false);
    }
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

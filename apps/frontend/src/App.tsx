import { useEffect, useState } from "react";
import { Provider } from "@/components/ui/provider";
import { Button } from "./components/ui/button";
import {
  Center,
  Container,
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
} from "@chakra-ui/react";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "./components/ui/dialog";
import { format } from "date-fns";
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "./services/firebase";
import { Field } from "./components/ui/field";

type Attendee = {
  id: string;
  name: string;
  phoneNumber: string;
};

type Event = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  rsvpBy: Date;
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
    id: attendee.id,
    name: attendee.name,
    phoneNumber: attendee.phoneNumber,
  };
}

const dummyEvents: Event[] = [
  {
    id: "1",
    name: "Sarah and Frank's 25th Birthday Party",
    startsAt: new Date("2025-01-10T18:00:00"),
    endsAt: new Date("2025-01-010T22:00:00"),
    rsvpBy: new Date("2025-01-07T23:59:59"),
    address: "123 Main St, Springfield, IL",
    descriptionHTML: `<p>
      Come celebrate Sarah and Frank's 25th birthday! We'll have food, drinks,
      and games. We can't wait to see you. 🎉
    </p>`,
  },
  {
    id: "2",
    name: "Civ Day 3: Nick's Revenge",
    startsAt: new Date("2022-01-15T18:00:00"),
    endsAt: new Date("2022-01-15T22:00:00"),
    rsvpBy: new Date("2022-01-14T23:59:59"),
    address: "456 Elm St, Springfield, IL",
    descriptionHTML: "<p>Come party with Frank!</p>",
  },
];

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
  return (
    <Container maxWidth="breakpoint-md">
      <Heading size="6xl">Sarah and Frank's Parties</Heading>
      <Button variant="subtle">I'm not {attendee.name}</Button>

      <HStack>
        <Field label="Name" helperText="In case we got it wrong">
          <Input defaultValue={attendee.name} />
        </Field>
        <Field label="Phone Number" helperText="So we can send you spam texts">
          <Input defaultValue={attendee.phoneNumber} />
        </Field>
      </HStack>

      <section>
        <Heading size="xl">Upcoming Events</Heading>

        <Stack>
          {dummyEvents.map((event) => (
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
                  {format(event.startsAt, "EEEE, MMM do 'at' h:mma")}
                </time>
              </Span>
              <Heading size="lg" my="2">
                <LinkOverlay href="#">{event.name}</LinkOverlay>
              </Heading>
              <Text
                mb="3"
                color="fg.muted"
                dangerouslySetInnerHTML={{ __html: event.descriptionHTML }}
              ></Text>
              <Link href="#inner-link" variant="underline" colorPalette="teal">
                RSVP with 6 others
              </Link>
            </LinkBox>
          ))}
        </Stack>
      </section>
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
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setIsAttendeeLoading(false);
        });
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

import { initializeApp } from "firebase/app";
import { DocumentData, DocumentReference, getFirestore, onSnapshot, Query } from "firebase/firestore";
import { useMemo, useState, useEffect } from "react";

const firebaseConfig = {
  apiKey: "AIzaSyAgRrE4DgrTkKf54TsQXARvtpOWKr-3kgs",
  authDomain: "sarah-and-frank-parties.firebaseapp.com",
  projectId: "sarah-and-frank-parties",
  storageBucket: "sarah-and-frank-parties.firebasestorage.app",
  messagingSenderId: "474808305837",
  appId: "1:474808305837:web:9828edca8ad56ee24a5e24",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


export function useDoc<D extends DocumentData & { id: string }>(
  ref: DocumentReference,
  isEnabled: boolean
): [D | null, boolean, Error | null] {
  const memoizedRef = useMemo(() => ref, [ref.path]);
  const [documentData, setDocumentData] = useState<D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      setDocumentData(null);
      setError(null);
      return;
    }

    const unsubscribe = onSnapshot(memoizedRef, (doc) => {
      if (doc.exists()) {
        const documentData = doc.data();
        if (documentData) {
          setDocumentData({
            id: doc.id,
            ...documentData,
          } as D);
          setError(null);
        }
      } else {
        setError(new Error("Document not found"));
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [memoizedRef, isEnabled]);

  return [documentData, isLoading, error];
}

export function useDocs<D extends DocumentData & { id: string }>(
  query: Query,
  isEnabled: boolean): [D[], boolean, Error | null] {
  const [documentDatas, setDocumentDatas] = useState<D[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      setDocumentDatas([]);
      setError(null);
      return;
    }

    const unsubscribe = onSnapshot(query, (querySnapshot) => {
      console.log("Query snapshot size: ", querySnapshot.size);
      
      const newDocumentDatas: D[] = []
      querySnapshot.docs.map((doc) => {
        newDocumentDatas.push({
          id: doc.id,
          ...doc.data(),
        } as D);
      });
      setDocumentDatas(newDocumentDatas);
      setError(null);
      
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [query, isEnabled]);

  return [documentDatas, isLoading, error];
}

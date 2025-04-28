import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Contact } from '../ai/handlers.ts';

export const fetchContacts = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'contacts'));
    const contacts = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      contacts.push({ id: doc.id, ...data });
      console.log('Contact data:', JSON.stringify(data));
    });

    return contacts as Contact[];
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
};

import { doc, setDoc } from 'firebase/firestore';
// import { broadcastMessage } from '../ai/index.ts';
import { db } from '../utils/firebase.ts';

export const maydayCall = async () => {
  console.log('maydayCall function called');

  const uuid = 'mayday' + new Date().getTime();
  const alert = {
    mayday: true,
  };

  await setDoc(doc(db, 'alerts', uuid), alert);

  // broadcastMessage({
  //   role: 'user',
  //   content: 'Mayday! Mayday! I need help!',
  //   sessionActive: false,
  //   sos: true,
  // });
  return JSON.stringify({
    success: true,
  });
};

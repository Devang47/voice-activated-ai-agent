import { doc, setDoc } from 'firebase/firestore';
// import { broadcastMessage } from '../ai/index.ts';
import { db } from '../utils/firebase.ts';
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.MAYDAY_AUTH;

const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    body: 'This is the ship that made the Kessel Run in fourteen parsecs?',
    from: '+13527760493',
    to: '+919258340781',
  });

  console.log(message.body);
}
export const maydayCall = async () => {
  console.log('maydayCall function called');

  const uuid = 'mayday' + new Date().getTime();
  const alert = {
    mayday: true,
  };

  createMessage();
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

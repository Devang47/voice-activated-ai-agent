import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { sessionManager } from '../ai/helpers.ts';
import storage from '../storage.ts';
import { getInterviewInstructions } from '../ai/constants.ts';
import WebSocket from 'ws';

class ResumeManager {
  public resumeText: string = '';
  public jobdesc: string = '';
  public jobdescEnabled: boolean = false;

  async readResume(ws: WebSocket) {
    try {
      const docRef = doc(db, 'objects', 'resume');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.resumeText = data.content;

        if (!this.resumeText.trim()) {
          throw new Error('No resume found');
        }
      } else {
        throw new Error('No such document!');
      }
    } catch (err) {
      console.log(err);

      ws.send(
        JSON.stringify({
          role: 'assistant',
          content: 'No resume found. Please upload a resume using the app.',
          sessionActive: true,
        }),
      );
    }

    const docRef = doc(db, 'objects', 'jobdesc');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      this.jobdesc = data.content;

      if (this.jobdesc.trim()) {
        this.jobdescEnabled = true;
      }
    } else {
      console.log('Job description not found');
    }
  }
}

export const resumeManager = new ResumeManager();

export const handleStartInterviewMode = async (
  ws: WebSocket,
  callback: () => void,
) => {
  await resumeManager.readResume(ws);

  await storage.addMessage(sessionManager.get() + '-interview', [
    {
      role: 'system',
      content: getInterviewInstructions(
        resumeManager.resumeText,
        resumeManager.jobdesc,
      ),
    },
  ]);

  callback();
  return '';
};

export const getResumeText = () => {
  return resumeManager.resumeText;
};

export const getJobDesc = () => {
  return resumeManager.jobdescEnabled ? resumeManager.jobdesc : '';
};

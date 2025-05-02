import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { exec } from 'child_process';
import util from 'util';

export const handleIntruder = async () => {
  const execPromise = util.promisify(exec);
  const imageName = new Date().getTime() + '.jpg';

  await execPromise(`fswebcam -r 1280x720 --no-banner tmp/${imageName}`);
  console.log('Image captured:', imageName);

  const imagePath = path.join('tmp', imageName);

  const imageStream = fs.createReadStream(imagePath);

  // Create form data
  const form = new FormData();
  form.append('file', imageStream);

  // API endpoint
  const apiEndpoint = 'http://10.46.48.77:3001/save-image';

  try {
    console.log('Sending image to server...');
    // Send the POST request
    axios
      .post(apiEndpoint, form, {
        headers: form.getHeaders(),
      })
      .then((response) => {
        console.log('Upload successful:', response.data);
      })
      .catch((error) => {
        console.error('Error uploading image:', error.message);
      });
  } catch (error) {
    console.log(error);
  }
};

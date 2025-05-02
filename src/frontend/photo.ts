import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

// Path to the image
const imagePath = path.join('image.jpg');

// Create a read stream
const imageStream = fs.createReadStream(imagePath);

// Create form data
const form = new FormData();
form.append('file', imageStream);

// API endpoint
const apiEndpoint = 'http://10.46.48.77:3001/save-image';

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

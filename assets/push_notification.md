Notifications
Push notifications & device token management (Firebase FCM)



POST
/api/notifications/register-token
Register or update a device FCM token for a user

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fcm_token": "string",
  "platform": "web",
  "device_id": "string"
}
Execute
Responses
Code	Description	Links
200	
Token registered

No links
500	
Server error

No links

POST
/api/notifications/remove-token
Remove a device FCM token (on logout)

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "fcm_token": "string"
}
Execute
Responses
Code	Description	Links
200	
Token removed

No links

POST
/api/notifications/send
Send a push notification to a specific user

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "string",
  "body": "string",
  "type": "string",
  "entity_type": "string",
  "entity_id": "string",
  "data": {},
  "sent_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sent_by_name": "string"
}
Execute
Responses
Code	Description	Links
200	
Notification sent

No links
500	
Server error

No links

POST
/api/notifications/send-bulk
Send a push notification to multiple users

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "user_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ],
  "title": "string",
  "body": "string",
  "type": "string",
  "entity_type": "string",
  "entity_id": "string",
  "data": {},
  "sent_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sent_by_name": "string"
}
Execute
Responses
Code	Description	Links
200	
Notifications sent

No links

POST
/api/notifications/send-all
Send a push notification to all active users

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "title": "string",
  "body": "string",
  "type": "string",
  "entity_type": "string",
  "entity_id": "string",
  "data": {},
  "sent_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sent_by_name": "string"
}
Execute
Responses
Code	Description	Links
200	
Notifications sent to all users

App nickname
madhuram-web
App ID 
1:611582097916:web:973c2f41aded2f10a2da79
Linked Firebase Hosting site
madhuram-1f7aa

SDK setup and configuration

npm

CDN

Config
If you're already using npm and a module bundler such as webpack or Rollup, you can run the following command to install the latest SDK (Learn more):

npm install firebase
Then, initialize Firebase and begin using the SDKs for the products you'd like to use.

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAlbqmxQURudeUXhOQB0AtB2EWUcFzX_uY",
  authDomain: "madhuram-1f7aa.firebaseapp.com",
  projectId: "madhuram-1f7aa",
  storageBucket: "madhuram-1f7aa.firebasestorage.app",
  messagingSenderId: "611582097916",
  appId: "1:611582097916:web:973c2f41aded2f10a2da79",
  measurementId: "G-2LKS963MSZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
Note: This option uses the modular JavaScript SDK, which provides reduced SDK size.

Learn more about Firebase for web: Get Started, Web SDK API Reference, Samples


web puhs private key : dRRFHUoe28ZA1uCYjBB5GyCE2cUEszpS1_73Dd2N6YY


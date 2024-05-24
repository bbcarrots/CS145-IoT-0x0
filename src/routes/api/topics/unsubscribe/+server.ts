import admin from 'firebase-admin';
import { json } from '@sveltejs/kit';
import serviceAccount from "../../../../../functions/config/serviceAccountPrivateKey.json" with { type: "json"}; // you can get the .json file on firebase service account .

let newServiceAccount = serviceAccount as any;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    const firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(newServiceAccount),
        databaseURL: "https://cs145-0x0-b0x0-labs-berdebox-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

export async function PATCH({ request }) {
    // Assume you have the registration token available
    const { registrationToken, topic } = await request.json();

    // Subscribe the device to a topic
    let response = await admin.messaging().unsubscribeFromTopic(registrationToken, topic);
    console.log('Successfully unsubscribed from topic');

    // Return response as a regular JavaScript object
    return json(response);
}


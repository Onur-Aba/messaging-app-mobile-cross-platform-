# Messaging App Mobile

A **cross-platform messaging application** built with **React Native and Expo**, designed as the **mobile companion** to the [Messaging App Desktop](https://github.com/Onur-Aba/messaging-app-desktop).  
Both projects share the same backend and real-time infrastructure powered by **Firebase**, allowing seamless communication between **mobile and desktop users**.

---

## 🚀 Features

- 💬 **Real-time Messaging** — Send and receive messages instantly using Firebase Realtime Database.  
- 👥 **Group Chats** — Create and manage group conversations (UI still under development).  
- 📩 **Group Invitations** — Invite users to join a group via unique invitation links or codes.  
- 🔁 **Message Forwarding** — Forward messages between chats or groups.  
- 🗑️ **Message Deletion** — Delete messages for yourself or (optionally) for all participants.  
- 💬 **Reply to Messages** — Quote and reply to specific messages in a conversation.  
- 🔔 **Notifications (planned)** — Push notifications for new messages and invites *(coming soon)*.  
- 🧑‍💻 **Cross-Platform Sync** — Chat seamlessly between desktop and mobile when using the same Firebase backend.

---

## 🛠️ Tech Stack

| Category | Technology |
|-----------|-------------|
| Framework | [React Native](https://reactnative.dev/) |
| Platform | [Expo](https://expo.dev/) |
| Backend | [Firebase](https://firebase.google.com/) (Auth, Realtime Database, Storage) |
| Language | TypeScript |
| State Management | React Context / Hooks |
| UI Components | React Native Paper / Custom Components |

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/Onur-Aba/messaging-app-mobile-cross-platform-.git
cd messaging-app-mobile-cross-platform-
```
2. Install dependencies

```bash
npm install
# or
yarn install
```
3. Configure environment variables
Create a .env file in the root directory and add your Firebase configuration keys:
```bash
.env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

```
⚠️ Important:
These keys must match those used in the Desktop Version if you want both platforms to communicate seamlessly.


4. Start the development server
```bash

npx expo start
```
Use Expo Go on your mobile device or an Android/iOS emulator to preview the app.

📱 Building for Production
To create a standalone build:

```bash

npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```
🔗 Firebase Integration
This app shares the same Firebase configuration and schema as the desktop version.
Messages, groups, and invitations are stored in Firebase Realtime Database and synchronized in real-time across all connected clients.

If you want to use both apps together:

Create a single Firebase project.

Use the same configuration in both projects’ .env files.

Enable Authentication, Realtime Database, and Storage in the Firebase Console.


## 🧠 Future Improvements
 Improved group chat UI

 Push notifications (Expo Notifications + Firebase Cloud Messaging)

 Media messages (images, audio, files)

 User profiles and avatars

 Message encryption (optional)

 Light/Dark mode


## 🌐 Related Projects
💻 Desktop Version:[ Onur-Aba/messaging-app-desktop](https://github.com/Onur-Aba/messaging-app-desktop)#


## ⚠️ Firebase Rules

For testing purposes only, you can temporarily allow all reads and writes by using:

```bash
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ Warning: Never leave these rules in production.
This setting makes your entire Firestore database publicly accessible.
const { onCall, HttpsError } =
  require("firebase-functions/v2/https");

const { initializeApp } =
  require("firebase-admin/app");

const { getAuth } =
  require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const ADMIN_EMAIL = "bespalicoa@gmail.com";

function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Trebuie să te autentifici."
    );
  }

  const email = String(
    request.auth.token.email || ""
  ).toLowerCase();

  if (
    email !== ADMIN_EMAIL ||
    request.auth.token.email_verified !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "Acces permis numai administratorului verificat."
    );
  }
}

// Înregistrarea activităților utilizatorilor.
exports.recordActivity = onCall(async request => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Autentificare necesară."
    );
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email || "";

  const allowedActions = [
    "Conectare",
    "Deconectare",
    "A creat o clasă",
    "A adăugat un elev",
    "A modificat un punctaj",
    "A modificat o evaluare",
    "A modificat setările"
  ];

  const action = String(
    request.data?.action || ""
  );

  if (!allowedActions.includes(action)) {
    throw new HttpsError(
      "invalid-argument",
      "Acțiune nepermisă."
    );
  }

  const profile = db
    .collection("atlasProfiles")
    .doc(uid);

  const event = profile
    .collection("activity")
    .doc();

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async transaction => {
    transaction.set(profile, {
      uid,
      email,
      lastActiveAt: now,
      lastActivity: action
    }, { merge: true });

    transaction.set(event, {
      uid,
      email,
      action,
      createdAt: now
    });
  });

  return { success: true };
});

// Lista conturilor din Firebase Authentication.
exports.adminListUsers = onCall(async request => {
  requireAdmin(request);

  const result = await getAuth().listUsers(1000);

  const users = [];

  for (const user of result.users) {
    const profile = await db
      .collection("atlasProfiles")
      .doc(user.uid)
      .get();

    const data = profile.exists
      ? profile.data()
      : {};

    users.push({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      createdAt: user.metadata.creationTime || null,
      lastSignInAt: user.metadata.lastSignInTime || null,
      lastActiveAt:
        data.lastActiveAt?.toDate?.()?.toISOString?.() || null,
      lastActivity: data.lastActivity || ""
    });
  }

  return { users };
});

// Istoricul activității unui utilizator.
exports.adminGetActivity = onCall(async request => {
  requireAdmin(request);

  const uid = String(request.data?.uid || "");

  if (!uid || uid.length > 150) {
    throw new HttpsError(
      "invalid-argument",
      "Identificator invalid."
    );
  }

  const snapshot = await db
    .collection("atlasProfiles")
    .doc(uid)
    .collection("activity")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const events = snapshot.docs.map(doc => {
    const data = doc.data();

    return {
      action: data.action || "",
      details: data.details || {},
      createdAt:
        data.createdAt?.toDate?.()?.toISOString?.() || null
    };
  });

  return { events };
});

// Generarea unui link pentru resetarea parolei.
exports.adminCreatePasswordResetLink = onCall(
  async request => {
    requireAdmin(request);

    const email = String(
      request.data?.email || ""
    ).trim().toLowerCase();

    if (!email) {
      throw new HttpsError(
        "invalid-argument",
        "Adresa de e-mail este obligatorie."
      );
    }

    try {
      const link = await getAuth()
        .generatePasswordResetLink(email, {
          url: "https://atlas-chi-bice.vercel.app/"
        });

      return { link };

    } catch (error) {
      throw new HttpsError(
        "internal",
        "Nu s-a putut genera linkul de resetare."
      );
    }
  }
);

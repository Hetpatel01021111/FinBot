/**
 * Converts Firestore data to plain JavaScript objects
 * Handles Timestamp, Date, and other non-serializable types
 */
const serializeFirestoreData = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Firestore Timestamp
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }

  // Handle objects (including Firestore DocumentData)
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeFirestoreData(data[key]);
      }
    }
    return result;
  }

  // Return primitives as-is
  return data;
};

export { serializeFirestoreData };

export const formatFirebaseError = (error: any): string => {
  if (!error) return 'Unknown error';
  
  // Handle Firebase Auth errors
  if (error.code) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already in use';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password';
      case 'permission-denied':
        return 'You do not have permission to perform this action';
      default:
        return error.message || 'An error occurred';
    }
  }
  
  return error.message || 'An error occurred';
};

// Helper to safely access nested object properties
export const safeGet = (obj: any, path: string, defaultValue: any = null) => {
  return path.split('.').reduce((acc, part) => {
    try {
      return acc && acc[part] !== undefined ? acc[part] : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }, obj);
};

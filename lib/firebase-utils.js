import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';

// Firestore utility functions
export const firebaseUtils = {
  // Create a new document
  async createDocument(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  // Get a single document by ID
  async getDocument(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  // Get multiple documents with optional filtering
  async getDocuments(collectionName, filters = [], orderByField = null, limitCount = null) {
    try {
      let q = collection(db, collectionName);
      
      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
      }
      
      // Apply limit
      if (limitCount) {
        q = query(q, limit(limitCount));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  },

  // Update a document
  async updateDocument(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  // Delete a document
  async deleteDocument(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Real-time listener for documents
  subscribeToCollection(collectionName, callback, filters = []) {
    try {
      let q = collection(db, collectionName);
      
      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      return onSnapshot(q, (querySnapshot) => {
        const documents = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(documents);
      });
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
      throw error;
    }
  },

  // Storage utility functions
  async uploadFile(file, path) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  async deleteFile(path) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};

// Specific utility functions for the FinBox app
export const finboxFirebaseUtils = {
  // User-related functions
  async createUser(userData) {
    return await firebaseUtils.createDocument('users', userData);
  },

  async getUser(userId) {
    return await firebaseUtils.getDocument('users', userId);
  },

  async getUserByClerkId(clerkUserId) {
    const users = await firebaseUtils.getDocuments('users', [
      { field: 'clerkUserId', operator: '==', value: clerkUserId }
    ]);
    return users.length > 0 ? users[0] : null;
  },

  // Account-related functions
  async createAccount(accountData) {
    return await firebaseUtils.createDocument('accounts', accountData);
  },

  async getUserAccounts(userId) {
    return await firebaseUtils.getDocuments('accounts', [
      { field: 'userId', operator: '==', value: userId }
    ]);
  },

  // Transaction-related functions
  async createTransaction(transactionData) {
    return await firebaseUtils.createDocument('transactions', transactionData);
  },

  async getUserTransactions(userId, limitCount = 50) {
    return await firebaseUtils.getDocuments('transactions', 
      [{ field: 'userId', operator: '==', value: userId }],
      { field: 'date', direction: 'desc' },
      limitCount
    );
  },

  async getAccountTransactions(accountId, limitCount = 50) {
    return await firebaseUtils.getDocuments('transactions',
      [{ field: 'accountId', operator: '==', value: accountId }],
      { field: 'date', direction: 'desc' },
      limitCount
    );
  },

  // Budget-related functions
  async createBudget(budgetData) {
    return await firebaseUtils.createDocument('budgets', budgetData);
  },

  async getUserBudget(userId) {
    const budgets = await firebaseUtils.getDocuments('budgets', [
      { field: 'userId', operator: '==', value: userId }
    ]);
    return budgets.length > 0 ? budgets[0] : null;
  },

  // Receipt upload function
  async uploadReceipt(file, userId, transactionId) {
    const path = `receipts/${userId}/${transactionId}/${file.name}`;
    return await firebaseUtils.uploadFile(file, path);
  }
};

export default firebaseUtils;

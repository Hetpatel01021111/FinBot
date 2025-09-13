import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// Upload file to Firebase Storage
export async function uploadFile(file, path) {
  try {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }

    if (!file) {
      throw new Error('No file provided');
    }

    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      success: true,
      url: downloadURL,
      path: snapshot.ref.fullPath,
      size: snapshot.metadata.size,
      contentType: snapshot.metadata.contentType
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

// Upload receipt image
export async function uploadReceiptImage(file, userId) {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `receipt_${timestamp}.${extension}`;
    const path = `receipts/${userId}/${filename}`;
    
    return await uploadFile(file, path);
  } catch (error) {
    console.error('Error uploading receipt:', error);
    throw error;
  }
}

// Delete file from Firebase Storage
export async function deleteFile(path) {
  try {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }

    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

// Get file download URL
export async function getFileURL(path) {
  try {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }

    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    
    return url;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw new Error(`Failed to get file URL: ${error.message}`);
  }
}

// Validate file type and size
export function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  } = options;

  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`);
  }

  return true;
}

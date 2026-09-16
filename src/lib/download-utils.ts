/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Transforms various cloud storage URLs (Google Drive, Dropbox, OneDrive)
 * into direct download links and preview URLs.
 */
export function formatDownloadUrl(rawUrl: string): {
  directDownloadUrl: string;
  previewEmbedUrl: string;
  isGoogleDrive: boolean;
  isDropbox: boolean;
  isDataUrl: boolean;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      directDownloadUrl: '',
      previewEmbedUrl: '',
      isGoogleDrive: false,
      isDropbox: false,
      isDataUrl: false,
    };
  }

  const trimmed = rawUrl.trim();

  // 1. Base64 / Data URL
  if (trimmed.startsWith('data:')) {
    return {
      directDownloadUrl: trimmed,
      previewEmbedUrl: trimmed,
      isGoogleDrive: false,
      isDropbox: false,
      isDataUrl: true,
    };
  }

  // 2. Google Drive Links
  // Formats:
  // - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  const driveOpenMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i);
  const driveId = driveFileMatch?.[1] || driveOpenMatch?.[1];

  if (driveId) {
    return {
      // Direct file download export
      directDownloadUrl: `https://drive.google.com/uc?export=download&id=${driveId}`,
      // Google Drive embedded preview
      previewEmbedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      isGoogleDrive: true,
      isDropbox: false,
      isDataUrl: false,
    };
  }

  // 3. Dropbox Links
  // Format: https://www.dropbox.com/s/xyz/book.pdf?dl=0 -> ?dl=1
  if (trimmed.includes('dropbox.com')) {
    let dlUrl = trimmed;
    if (dlUrl.includes('?dl=0')) {
      dlUrl = dlUrl.replace('?dl=0', '?dl=1');
    } else if (dlUrl.includes('?raw=1')) {
      dlUrl = dlUrl;
    } else if (!dlUrl.includes('?')) {
      dlUrl = `${dlUrl}?dl=1`;
    }
    return {
      directDownloadUrl: dlUrl,
      previewEmbedUrl: trimmed.replace('?dl=1', '?raw=1'),
      isGoogleDrive: false,
      isDropbox: true,
      isDataUrl: false,
    };
  }

  // 4. Standard Direct URL (e.g. .pdf, .epub, CDN link)
  return {
    directDownloadUrl: trimmed,
    previewEmbedUrl: trimmed,
    isGoogleDrive: false,
    isDropbox: false,
    isDataUrl: false,
  };
}

/**
 * Triggers a browser download for any file URL, Base64 Data URL, or Cloud link,
 * safely handling browser sandbox / iframe restrictions and setting the file name.
 */
export async function triggerFileDownload(
  fileUrl: string,
  fileName: string = 'Spiritual-Book.pdf'
): Promise<{ success: boolean; message?: string }> {
  if (!fileUrl) {
    return { success: false, message: 'No download link available for this book.' };
  }

  const { directDownloadUrl, isDataUrl, isGoogleDrive } = formatDownloadUrl(fileUrl);
  const safeFileName = sanitizeFileName(fileName);

  try {
    // Case 1: Data URL (Base64 PDF / document)
    if (isDataUrl || directDownloadUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(directDownloadUrl);
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFileName.endsWith('.pdf') ? safeFileName : `${safeFileName}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1500);

      return { success: true, message: 'Book downloaded successfully!' };
    }

    // Case 2: Google Drive direct download
    if (isGoogleDrive) {
      // Trigger download via invisible anchor and open preview tab as reliable fallback
      const link = document.createElement('a');
      link.href = directDownloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = safeFileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 1000);

      return { success: true, message: 'Initiating Google Drive download...' };
    }

    // Case 3: Fetch blob or fallback to direct link
    try {
      const response = await fetch(directDownloadUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 1500);

        return { success: true, message: 'Book downloaded successfully!' };
      }
    } catch (corsErr) {
      // CORS prevented fetch, fallback to standard link opening
    }

    // Fallback: Open direct download URL in new window/tab
    const fallbackLink = document.createElement('a');
    fallbackLink.href = directDownloadUrl;
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    fallbackLink.download = safeFileName;
    fallbackLink.style.display = 'none';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    setTimeout(() => {
      if (document.body.contains(fallbackLink)) {
        document.body.removeChild(fallbackLink);
      }
    }, 1000);

    return { success: true, message: 'Opening book download link...' };
  } catch (err: any) {
    console.error('Download error:', err);
    // Ultimate fallback
    window.open(directDownloadUrl, '_blank', 'noopener,noreferrer');
    return { success: false, message: 'Opened book in new tab for download.' };
  }
}

/**
 * Converts a Base64 data URL to a binary Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ia], { type: mime });
}

/**
 * Sanitize file name for OS compatibility
 */
export function sanitizeFileName(name: string): string {
  return (name || 'Spiritual-Book')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

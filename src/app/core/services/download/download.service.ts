import { Injectable } from '@angular/core';
import { safeFileName } from '../../utilities/file.util';

@Injectable({ providedIn: 'root' })
export class DownloadService {
  download(data: Blob | File, filename: string): void {
    const name = safeFileName(filename);
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

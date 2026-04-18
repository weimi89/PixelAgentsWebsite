import * as fs from 'fs';
import * as path from 'path';

/** 原子寫入 JSON 檔案（.tmp + fsync + rename），失敗時自動清理暫存檔 */
export function atomicWriteJson(filePath: string, data: unknown): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const json = JSON.stringify(data, null, 2);
	const tmpPath = filePath + '.tmp';
	let tmpFd: number | null = null;
	try {
		tmpFd = fs.openSync(tmpPath, 'w');
		fs.writeSync(tmpFd, json, 0, 'utf-8');
		// 先落盤 tmp 檔內容，再 rename，確保斷電時不會留下半寫入的正式檔案
		fs.fsyncSync(tmpFd);
		fs.closeSync(tmpFd);
		tmpFd = null;
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		if (tmpFd !== null) {
			try { fs.closeSync(tmpFd); } catch { /* ignore */ }
		}
		try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
		throw err;
	}
}

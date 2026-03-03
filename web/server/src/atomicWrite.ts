import * as fs from 'fs';
import * as path from 'path';

/** 原子寫入 JSON 檔案（.tmp + rename），失敗時自動清理暫存檔 */
export function atomicWriteJson(filePath: string, data: unknown): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const json = JSON.stringify(data, null, 2);
	const tmpPath = filePath + '.tmp';
	try {
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
		throw err;
	}
}

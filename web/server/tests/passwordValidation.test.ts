import { describe, it, expect } from 'vitest';
import { validatePassword } from 'pixel-agents-shared';

describe('validatePassword', () => {
	describe('基本強度', () => {
		it('rejects passwords shorter than 8 chars', () => {
			const result = validatePassword('Ab1');
			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/at least 8/i);
		});

		it('rejects passwords without uppercase', () => {
			const result = validatePassword('abc12345');
			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/uppercase/i);
		});

		it('rejects passwords without lowercase', () => {
			const result = validatePassword('ABC12345');
			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/lowercase/i);
		});

		it('rejects passwords without digit', () => {
			const result = validatePassword('AbcdEfGh');
			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/digit/i);
		});

		it('accepts minimum valid password', () => {
			const result = validatePassword('Abcd1234');
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('accepts longer passwords', () => {
			expect(validatePassword('LongerPassword123').valid).toBe(true);
		});
	});

	describe('requireSpecial option', () => {
		it('accepts letter+digit-only passwords when requireSpecial is false (default)', () => {
			expect(validatePassword('Abcd1234').valid).toBe(true);
			expect(validatePassword('Abcd1234', {}).valid).toBe(true);
			expect(validatePassword('Abcd1234', { requireSpecial: false }).valid).toBe(true);
		});

		it('rejects letter+digit-only when requireSpecial is true', () => {
			const result = validatePassword('Abcd1234', { requireSpecial: true });
			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/special character/i);
		});

		it.each([
			'Abcd1234!',
			'Abcd1234@',
			'Abcd1234#',
			'Abcd1234$',
			'Abcd1234%',
			'Abcd1234^',
			'Abcd1234&',
			'Abcd1234*',
			'Abcd1234(',
			'Abcd1234,',
			'Abcd1234.',
			'Abcd1234?',
			'Abcd1234-',
			'Abcd1234_',
			'Abcd1234=',
		])('accepts password with special char: %s', (password) => {
			expect(validatePassword(password, { requireSpecial: true }).valid).toBe(true);
		});
	});

	describe('邊界情境', () => {
		it('handles exactly 8 char boundary', () => {
			// 8 字元含所有類別
			expect(validatePassword('Abcdef12').valid).toBe(true);
			// 7 字元含所有類別（應失敗）
			expect(validatePassword('Abcde12').valid).toBe(false);
		});
	});
});

/** 密碼最小長度 */
const PASSWORD_MIN_LENGTH = 8;

export interface PasswordValidationResult {
	valid: boolean;
	error?: string;
}

export interface PasswordValidationOptions {
	/** 是否強制要求至少一個特殊字元（預設 false，保持向下相容） */
	requireSpecial?: boolean;
}

/** 驗證密碼強度：至少 8 字元，含大小寫字母及數字；可選擇強制特殊字元 */
export function validatePassword(
	password: string,
	options: PasswordValidationOptions = {},
): PasswordValidationResult {
	if (password.length < PASSWORD_MIN_LENGTH) {
		return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
	}
	if (!/[A-Z]/.test(password)) {
		return { valid: false, error: 'Password must contain at least one uppercase letter' };
	}
	if (!/[a-z]/.test(password)) {
		return { valid: false, error: 'Password must contain at least one lowercase letter' };
	}
	if (!/[0-9]/.test(password)) {
		return { valid: false, error: 'Password must contain at least one digit' };
	}
	if (options.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
		return { valid: false, error: 'Password must contain at least one special character' };
	}
	return { valid: true };
}

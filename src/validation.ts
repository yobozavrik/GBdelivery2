/**
 * Comprehensive input validation and sanitization utility class
 * Provides security-focused validation methods for user inputs
 */
class InputValidator {
    /**
     * Sanitizes a string to prevent XSS attacks
     */
    static sanitizeString(str: any): string {
        if (typeof str !== 'string') return '';

        const temp = document.createElement('div');
        temp.textContent = str;
        let sanitized = temp.innerHTML;

        sanitized = sanitized
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();

        return sanitized;
    }

    /**
     * Sanitizes HTML content by encoding special characters
     */
    static sanitizeHTML(str: any): string {
        if (typeof str !== 'string') return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    /**
     * Validates and sanitizes URLs, only allowing http/https protocols
     */
    static sanitizeURL(url: any): string {
        if (typeof url !== 'string') return '';
        try {
            const parsed = new URL(url, window.location.origin);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return '';
            }
            return parsed.href;
        } catch {
            return '';
        }
    }

    /**
     * Validates product name length (2-100 characters after sanitization)
     */
    static validateProductName(name: string): boolean {
        const sanitized = this.sanitizeString(name);
        return sanitized.length >= 2 && sanitized.length <= 100;
    }

    /**
     * Validates quantity is a positive number between 0 and 10,000
     */
    static validateQuantity(qty: any): boolean {
        const num = typeof qty === 'number' ? qty : parseFloat(qty);
        return !isNaN(num) && num > 0 && num <= 10000;
    }

    /**
     * Validates price is a non-negative number up to 100,000
     */
    static validatePrice(price: any): boolean {
        const num = typeof price === 'number' ? price : parseFloat(price);
        return !isNaN(num) && num >= 0 && num <= 100000;
    }

    /**
     * Validates location string length (2-100 characters)
     */
    static validateLocation(location: string): boolean {
        const sanitized = this.sanitizeString(location);
        return sanitized.length >= 2 && sanitized.length <= 100;
    }

    /**
     * Validates uploaded file size and image type (max 10MB)
     */
    static validateFile(file: File | null): boolean {
        if (!file) return true;
        const maxSize = 10 * 1024 * 1024; // 10MB
        const isImageType = typeof file.type === 'string' && file.type.startsWith('image/');
        const hasImageExtension = typeof file.name === 'string'
            && /\.(apng|avif|bmp|gif|heic|heif|ico|jfif|jpg|jpeg|png|svg|tif|tiff|webp)$/i.test(file.name);
        return file.size <= maxSize && (isImageType || hasImageExtension);
    }

    /**
     * Validates email address format using RFC 5322 compliant regex
     */
    static validateEmail(email: any): boolean {
        if (typeof email !== 'string') return false;

        const sanitized = this.sanitizeString(email.trim());
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        return emailRegex.test(sanitized) && sanitized.length <= 254;
    }

    /**
     * Enhanced number validation with type checking and range validation
     */
    static validateNumber(value: any, options: {
        min?: number;
        max?: number;
        allowNegative?: boolean;
        allowDecimals?: boolean;
        maxDecimals?: number;
    } = {}): boolean {
        const {
            min,
            max,
            allowNegative = true,
            allowDecimals = true,
            maxDecimals
        } = options;

        const num = typeof value === 'string' ? parseFloat(value.trim()) : value;

        if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
            return false;
        }

        if (!allowNegative && num < 0) {
            return false;
        }

        if (!allowDecimals && !Number.isInteger(num)) {
            return false;
        }

        if (maxDecimals !== undefined && allowDecimals) {
            const decimals = (num.toString().split('.')[1] || '').length;
            if (decimals > maxDecimals) {
                return false;
            }
        }

        if (min !== undefined && num < min) {
            return false;
        }
        if (max !== undefined && num > max) {
            return false;
        }

        return true;
    }

    /**
     * Validates phone number (Ukrainian format)
     */
    static validatePhone(phone: any): boolean {
        if (typeof phone !== 'string') return false;

        const sanitized = phone.replace(/[\s\-\(\)]/g, '');
        const phoneRegex = /^(\+380|380|0)[0-9]{9}$/;

        return phoneRegex.test(sanitized);
    }
}

export { InputValidator };

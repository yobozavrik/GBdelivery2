// Input validation utilities extracted from app.js

/**
 * Comprehensive input validation and sanitization utility class
 * Provides security-focused validation methods for user inputs
 */
class InputValidator {
    /**
     * Sanitizes a string to prevent XSS attacks
     * @param {string} str - The string to sanitize
     * @returns {string} Sanitized string safe for DOM insertion
     */
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';

        // Enhanced sanitization using DOM API for comprehensive XSS protection
        const temp = document.createElement('div');
        temp.textContent = str;
        let sanitized = temp.innerHTML;

        // Additional safety: remove any remaining dangerous patterns
        sanitized = sanitized
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();

        return sanitized;
    }

    /**
     * Sanitizes HTML content by encoding special characters
     * @param {string} str - The HTML string to sanitize
     * @returns {string} Sanitized HTML string
     */
    static sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    /**
     * Validates and sanitizes URLs, only allowing http/https protocols
     * @param {string} url - The URL to validate and sanitize
     * @returns {string} Sanitized URL or empty string if invalid
     */
    static sanitizeURL(url) {
        if (typeof url !== 'string') return '';
        try {
            const parsed = new URL(url, window.location.origin);
            // Only allow http and https protocols
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
     * @param {string} name - The product name to validate
     * @returns {boolean} True if valid, false otherwise
     */
    static validateProductName(name) {
        const sanitized = this.sanitizeString(name);
        return sanitized.length >= 2 && sanitized.length <= 100;
    }

    /**
     * Validates quantity is a positive number between 0 and 10,000
     * @param {string|number} qty - The quantity to validate
     * @returns {boolean} True if valid, false otherwise
     */
    static validateQuantity(qty) {
        const num = parseFloat(qty);
        return !isNaN(num) && num > 0 && num <= 10000;
    }

    /**
     * Validates price is a non-negative number up to 100,000
     * @param {string|number} price - The price to validate
     * @returns {boolean} True if valid, false otherwise
     */
    static validatePrice(price) {
        const num = parseFloat(price);
        return !isNaN(num) && num >= 0 && num <= 100000;
    }

    /**
     * Validates location string length (2-100 characters)
     * @param {string} location - The location to validate
     * @returns {boolean} True if valid, false otherwise
     */
    static validateLocation(location) {
        const sanitized = this.sanitizeString(location);
        return sanitized.length >= 2 && sanitized.length <= 100;
    }

    /**
     * Validates uploaded file size and image type (max 10MB)
     * @param {File} file - The file to validate
     * @returns {boolean} True if valid or no file provided, false otherwise
     */
    static validateFile(file) {
        if (!file) return true;
        const maxSize = 10 * 1024 * 1024; // 10MB
        const isImageType = typeof file.type === 'string' && file.type.startsWith('image/');
        const hasImageExtension = typeof file.name === 'string'
            && /\.(apng|avif|bmp|gif|heic|heif|ico|jfif|jpg|jpeg|png|svg|tif|tiff|webp)$/i.test(file.name);
        return file.size <= maxSize && (isImageType || hasImageExtension);
    }

    /**
     * Validates email address format using RFC 5322 compliant regex
     * @param {string} email - The email address to validate
     * @returns {boolean} True if valid email format, false otherwise
     */
    static validateEmail(email) {
        if (typeof email !== 'string') return false;

        const sanitized = this.sanitizeString(email.trim());

        // RFC 5322 compliant email regex (simplified but robust)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        return emailRegex.test(sanitized) && sanitized.length <= 254;
    }

    /**
     * Enhanced number validation with type checking and range validation
     * @param {string|number} value - The value to validate as a number
     * @param {Object} options - Validation options
     * @param {number} [options.min] - Minimum allowed value (inclusive)
     * @param {number} [options.max] - Maximum allowed value (inclusive)
     * @param {boolean} [options.allowNegative=true] - Whether to allow negative numbers
     * @param {boolean} [options.allowDecimals=true] - Whether to allow decimal numbers
     * @param {number} [options.maxDecimals] - Maximum number of decimal places
     * @returns {boolean} True if valid number, false otherwise
     */
    static validateNumber(value, options = {}) {
        const {
            min,
            max,
            allowNegative = true,
            allowDecimals = true,
            maxDecimals
        } = options;

        // Convert to number
        const num = typeof value === 'string' ? parseFloat(value.trim()) : value;

        // Check if it's a valid number
        if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
            return false;
        }

        // Check negative constraint
        if (!allowNegative && num < 0) {
            return false;
        }

        // Check decimal constraint
        if (!allowDecimals && !Number.isInteger(num)) {
            return false;
        }

        // Check decimal places
        if (maxDecimals !== undefined && allowDecimals) {
            const decimals = (num.toString().split('.')[1] || '').length;
            if (decimals > maxDecimals) {
                return false;
            }
        }

        // Check range
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
     * @param {string} phone - The phone number to validate
     * @returns {boolean} True if valid phone number, false otherwise
     */
    static validatePhone(phone) {
        if (typeof phone !== 'string') return false;

        const sanitized = phone.replace(/[\s\-\(\)]/g, '');

        // Ukrainian phone: +380XXXXXXXXX or 0XXXXXXXXX
        const phoneRegex = /^(\+380|380|0)[0-9]{9}$/;

        return phoneRegex.test(sanitized);
    }
}

export { InputValidator };

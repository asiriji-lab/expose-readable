"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyOtpAction } from '../actions';
import { Mail, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

const VerifyBox: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';
    const role = searchParams.get('role') as 'admin' | 'teacher' | 'student' | null;

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!email) {
            setError('No email provided. Please try registering again.');
        }
        // Focus first input on mount
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [email]);

    const handleChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;

        const newOtp = [...otp];
        // Allow pasting
        if (value.length > 1) {
            const pastedData = value.slice(0, 6).split('');
            for (let i = 0; i < 6; i++) {
                if (pastedData[i]) newOtp[i] = pastedData[i];
            }
            setOtp(newOtp);
            const nextEmptyIndex = newOtp.findIndex(val => val === '');
            const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
            inputRefs.current[focusIndex]?.focus();
            return;
        }

        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value !== '' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) {
                // Move to previous input if current is empty and backspace is pressed
                const newOtp = [...otp];
                newOtp[index - 1] = '';
                setOtp(newOtp);
                inputRefs.current[index - 1]?.focus();
            } else {
                // Just clear current input
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const verifyOtpCode = async (code: string) => {
        if (!email) return;
        setLoading(true);
        setError('');

        try {
            const result = await verifyOtpAction(email, code);

            if (result.error) {
                throw new Error(result.error);
            }

            setIsSuccess(true);
            setTimeout(() => {
                const redirectPath = role === 'teacher'
                    ? '/teacher/dashboard'
                    : role === 'student'
                        ? '/student/dashboard'
                        : '/dashboard';
                router.push(redirectPath);
            }, 1500);

        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            // Clear inputs on error
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Auto-submit when all 6 digits are filled
    useEffect(() => {
        const code = otp.join('');
        if (code.length === 6 && !loading && !isSuccess) {
            verifyOtpCode(code);
        }
    }, [otp]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length === 6) {
            verifyOtpCode(code);
        } else {
            setError('Please enter all 6 digits');
        }
    };

    const handleResend = () => {
        // In a full implementation, you'd call a resend action here
        alert('A new code has been sent to ' + email);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-8 w-[450px] min-h-[500px] flex flex-col relative">
            <button
                onClick={() => router.push('/login')}
                className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <ArrowLeft size={24} />
            </button>

            <div className="flex-1 flex flex-col items-center mt-6">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                    <Mail className="w-8 h-8 text-indigo-600" />
                </div>

                <h1 className="text-2xl font-bold text-center mb-2">Check your email</h1>
                <p className="text-gray-500 text-center text-sm mb-8 px-4">
                    We sent a verification code to <br />
                    <span className="font-semibold text-gray-800">{email || 'your email'}</span>
                </p>

                {error && (
                    <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full">
                    <div className="flex justify-between gap-2 mb-8">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => {
                                    inputRefs.current[index] = el;
                                }}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                disabled={loading || isSuccess}
                                className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all ${error ? 'border-red-300 bg-red-50' : digit ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || isSuccess || otp.join('').length !== 6 || !email}
                        className={`w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${isSuccess
                                ? 'bg-green-500 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:bg-indigo-600'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Verifying...</span>
                            </>
                        ) : isSuccess ? (
                            <span>Verified Successfully!</span>
                        ) : (
                            <>
                                <span>Verify Email</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm">
                    <p className="text-gray-500">
                        Didn't receive the code?{' '}
                        <button
                            onClick={handleResend}
                            type="button"
                            className="text-indigo-600 font-medium hover:text-indigo-700 hover:underline transition-all"
                        >
                            Click to resend
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyBox;

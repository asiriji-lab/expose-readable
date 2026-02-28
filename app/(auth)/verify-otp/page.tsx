import React from 'react';
import VerifyBox from './components/VerifyBox';

const VerifyOTPPage: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            {/* Owl Logo at Top */}
            <div className="mb-2">
                <img
                    src="/owl-logo.svg"
                    alt="ScheDool Owl"
                    className="w-24 h-24"
                />
            </div>
            <VerifyBox />
        </div>
    );
};

export default VerifyOTPPage;

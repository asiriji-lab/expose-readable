import React from 'react';
import Box from './components/box';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface">
      {/* Owl Logo at Top */}
      <div className="mb-2">
        <img 
          src="/owl-logo.svg" 
          alt="ScheDool Owl" 
          className="w-24 h-24"
        />
      </div>
      <Box />
    </div>
  );
};

export default App;
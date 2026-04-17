export const dynamic = 'force-dynamic';

import React from 'react';
import Box from './components/box';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Box />
    </div>
  );
};

export default App;
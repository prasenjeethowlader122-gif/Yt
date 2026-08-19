'use client';

import { ErrorBoundary } from '@/components/error-boundary';
import Workspace from '@/screens/workspace';

function App() {
  return (
    <ErrorBoundary resetKey="/">
      <Workspace />
    </ErrorBoundary>
  );
}

export default App;

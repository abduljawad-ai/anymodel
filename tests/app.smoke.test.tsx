import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders app root', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toBeInTheDocument();
});

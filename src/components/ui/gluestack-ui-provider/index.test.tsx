import { render } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import { GluestackUIProvider } from './index';

describe('GluestackUIProvider', () => {
  let setColorSchemeSpy: jest.SpyInstance;

  beforeEach(() => {
    setColorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  });

  afterEach(() => {
    setColorSchemeSpy.mockRestore();
  });

  it('mode が system なら OS に従う unspecified を Appearance に渡す', async () => {
    await render(<GluestackUIProvider mode="system" />);

    expect(setColorSchemeSpy).toHaveBeenCalledWith('unspecified');
  });

  it('mode が dark なら dark をそのまま Appearance に渡す', async () => {
    await render(<GluestackUIProvider mode="dark" />);

    expect(setColorSchemeSpy).toHaveBeenCalledWith('dark');
  });
});

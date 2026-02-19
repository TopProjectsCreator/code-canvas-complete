import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { IDELayout } from '@/components/ide';
import { ThemeImportDialog } from '@/components/ide/ThemeImportDialog';
import { useTheme } from '@/contexts/ThemeContext';

const Index = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addCustomTheme } = useTheme();
  const [themeImportData, setThemeImportData] = useState<string | null>(null);

  useEffect(() => {
    const themeParam = searchParams.get('theme');
    if (themeParam) {
      setThemeImportData(themeParam);
      // Clean the URL
      searchParams.delete('theme');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  return (
    <>
      <IDELayout projectId={projectId} />
      <ThemeImportDialog
        open={!!themeImportData}
        onOpenChange={(open) => { if (!open) setThemeImportData(null); }}
        onImport={(theme) => {
          addCustomTheme(theme);
          setThemeImportData(null);
        }}
        initialData={themeImportData || undefined}
      />
    </>
  );
};

export default Index;
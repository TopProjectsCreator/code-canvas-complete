import { useParams } from 'react-router-dom';
import { IDELayout } from '@/components/ide';

const Index = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  
  return <IDELayout projectId={projectId} />;
};

export default Index;
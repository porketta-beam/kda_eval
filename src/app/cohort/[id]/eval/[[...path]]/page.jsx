'use client';
import { use } from 'react';
import EvalNode from '@/components/eval/EvalNode';

export default function EvalCatchAllPage({ params }) {
  const { id: cohortId, path = [] } = use(params);
  return <EvalNode cohortId={cohortId} path={path} />;
}

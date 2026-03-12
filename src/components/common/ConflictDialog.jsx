'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ConflictDialog({ open, onClose, onKeepMine, onUseServer }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>버전 충돌</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          다른 사용자가 데이터를 수정했습니다. 어떻게 처리하시겠습니까?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onUseServer}>서버 버전 사용</Button>
          <Button onClick={onKeepMine}>내 버전 유지</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

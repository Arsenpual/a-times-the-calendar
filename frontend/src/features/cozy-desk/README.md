# Cozy Desk Mode

พื้นที่ทำงานแบบ Pixel Interactive Workspace ของ T.i.M.E.S. ที่โหลดแบบ lazy (`React.lazy`) เมื่อผู้ใช้เปิดโหมด Cozy Desk เป็นครั้งแรก

## โครงสร้าง

- `cozy-desk-mode.jsx`: Lazy boundary และ container ที่คงสถานะเมื่อสลับไปโหมดอื่น
- `CozyDeskApp.tsx`: ตัวประสานงานหลักของห้องทำงาน, สถานะตัวละคร, และหน้าต่างเครื่องมือ
- `api/`: การเชื่อมต่อ Backend (`/api/cozy-desk`) และ Google Workspace/YouTube APIs (`cozyApi.ts`, `driveApi.ts`, `gmailApi.ts`, `sleepLogsApi.ts`, `tasksApi.ts`, `youtubeApi.ts`, `youtubeAuth.ts`)
- `components/`: หน้าต่างโต้ตอบ, HUD, และ sub-components ที่แยกตามโดเมน (`GameCanvas.tsx`, `TopHud.tsx`, `CozyViewportChrome.tsx`, `CozyModalsLayer.tsx`, `WorkspacePanel.tsx`, `WorkspaceSubcomponents.tsx`, `TasksPinboardModal.tsx`, `TasksPinboardSubsections.tsx`, `SleepQuestModal.tsx`, `SleepDriveImagePicker.tsx`, `SleepQuestSubsections.tsx`, `MailboxModal.tsx`, `DriveTableModal.tsx`, `SaveToDriveModal.tsx`, `TvModal.tsx`, `TvModalSubsections.tsx`, `AiStudioModal.tsx`, `AiStudioSubsections.tsx`, `AntigravityModal.tsx`, `AntigravitySubsections.tsx`, `TitleScreen.tsx`)
- `game/`: แผนที่, พิกัดชน/โต้ตอบ, กล้อง, ซิมูเลชัน และการวาดฉาก (`houseMap.ts`, `houseCollisionAndInteractables.ts`, `inspectableObjects.ts`, `pathfinding.ts`, `cameraAndProximity.ts`, `simulationStep.ts`, `minaNpcSimulation.ts`, `canvasPointerController.ts`, `gameLoopStep.ts`, `pixelRenderer.ts`, `upperRoomsArchitectureRenderer.ts`, `upperRoomsFurnitureRenderer.ts`, `characterRenderer.ts`, `lowerRoomsRenderer.ts`, `bathroomRenderer.ts`, `southRoomsRenderer.ts`, `southWallsRenderer.ts`, `southExteriorAndPropsRenderer.ts`, `southBadgesAndMailboxRenderer.ts`, `westBedroomRenderer.ts`)
- `hooks/`: Custom hooks แยกตามโดเมนของ Cozy Desk (`useCanvasCommandEffects.ts`, `useCozyQuestsAndStatuses.ts`, `useCozyWorldInteractions.ts`, `useCozyTaskDeliveryAndScheduler.ts`, `useCozyAssistantStreaming.ts`)
- `lib/`: ตรรกะและค่าเริ่มต้นฝั่งไคลเอนต์ (`cozyDeskDefaults.ts`, `driveExport.ts`, `minaTaskScheduler.ts`, `plantQuestStorage.ts`, `sound.ts`)
- `styles/cozy-desk.css`: สไตล์เฉพาะของโหมด Cozy Desk
- `types/game.ts`: Type definitions ของระบบเกมและการเชื่อมต่อข้อมูล

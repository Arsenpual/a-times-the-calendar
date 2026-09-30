import { useRef, useState } from "react";

export default function AssistantPreferenceCandidate({
  field,
  candidate,
  onSave,
  onDismiss,
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const act = async (accept) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (accept) await onSave(field.key, candidate.value, true);
      else await onDismiss(field.key);
    } catch (requestError) {
      setError(requestError.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const label =
    field.type === "duration" ? `${candidate.value} นาที` : candidate.value;
  return (
    <div className="settings-assistant-candidate" aria-busy={pending}>
      <span>
        MR.Zettascale สังเกตว่าคุณแก้ “{field.label}” เป็น{" "}
        <strong>{label}</strong> ซ้ำ {candidate.count} ครั้ง
      </span>
      <div>
        <button
          type="button"
          className="settings-assistant-action"
          disabled={pending}
          onClick={() => act(true)}
        >
          ใช้เป็นค่าเริ่มต้น
        </button>
        <button
          type="button"
          className="settings-assistant-delete"
          disabled={pending}
          onClick={() => act(false)}
        >
          ไม่ใช้
        </button>
      </div>
      {error && (
        <p className="settings-assistant-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import { useParams } from "react-router-dom";

export default function Call() {
  const { callId } = useParams();

  return <div>Call {callId}</div>;
}

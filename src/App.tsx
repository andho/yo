import { useNavigate } from "react-router-dom";
import ShortUniqueId from "short-unique-id";

const idGenerator = new ShortUniqueId({ length: 10 });

function App() {
  const navigate = useNavigate();

  const handleCreate = () => {
    const callId = idGenerator.rnd();
    navigate(`/${callId}`);
  };

  return (
    <div>
      <button onClick={handleCreate}>Create call</button>
    </div>
  );
}

export default App;

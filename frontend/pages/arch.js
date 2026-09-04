export default function ArchPage() {
  return (
    <div className="diagram-page">
      <iframe
        src="/arch.html"
        title="System Architecture"
        className="diagram-frame"
      />
      <style jsx>{`
        .diagram-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .diagram-frame {
          flex: 1;
          width: 100%;
          border: none;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

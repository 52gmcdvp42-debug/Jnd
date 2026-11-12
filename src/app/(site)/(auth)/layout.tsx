export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-grid relative bg-navy py-16 sm:py-24">
      <div className="container-x flex justify-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">{children}</div>
      </div>
    </div>
  );
}

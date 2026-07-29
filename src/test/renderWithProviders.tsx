import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { AuthProvider } from "context/AuthContext";
import type { User } from "types";
import { server } from "./msw/server";

interface Options {
  route?: string;
  user?: User | null;
}

// Kiểu trả về để TS TỰ SUY: repo có hai bản @testing-library/dom nên mọi cách
// gọi tên kiểu RenderResult ra đều vênh với thứ render() thật sự trả về.
// Nơi gọi vẫn nhận đủ screen-queries + queryClient.
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", user = null }: Options = {},
) {
  // AuthProvider hydrate bằng fetchMe() lúc mount -> phải cài handler TRƯỚC render.
  if (user) {
    server.use(
      http.get("http://localhost:4000/auth/me", () => HttpResponse.json(user)),
    );
  }

  // retry:false để test không phải chờ 1 lần thử lại; gcTime:0 để cache không
  // rò từ test này sang test khác.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        // Khớp future flags của BrowserRouter trong App.tsx — nếu không, test
        // chạy một cấu hình router khác app thật (và in warning v7).
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}

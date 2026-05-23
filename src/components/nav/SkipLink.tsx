/**
 * Enlace "Saltar al contenido principal" para accesibilidad por teclado.
 * Está visualmente oculto hasta recibir foco; al activarse mueve el foco al
 * elemento con `id="main-content"`.
 *
 * Debe inyectarse como **primer** child del layout, antes de cualquier nav.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary focus:shadow-dropdown focus:outline-none"
    >
      Saltar al contenido principal
    </a>
  );
}

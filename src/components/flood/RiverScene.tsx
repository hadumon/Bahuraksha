export function RiverScene({
  waterLevel,
  flowSpeed,
}: {
  waterLevel: number;
  flowSpeed: number;
}) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black pointer-events-none">
      {/* 
        This is a high-quality 4K looping river video from YouTube.
        It is muted, looping, and has no controls to act as a perfect background.
        The pointer-events-none ensures it doesn't block UI interactions.
      */}
      <iframe
        className="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] -translate-x-1/2 -translate-y-1/2 object-cover opacity-80"
        src="https://www.youtube.com/embed/gvkj4L0ZebI?autoplay=1&mute=1&loop=1&playlist=gvkj4L0ZebI&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1&iv_load_policy=3"
        title="River Background"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
      {/* Overlay to ensure text readability over the video */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1420] via-transparent to-[#0a1420]/50" />
    </div>
  );
}

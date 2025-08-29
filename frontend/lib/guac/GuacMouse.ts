import Guacamole from 'guacamole-common-js';

interface MouseHandlers {
  onmousedown?: ((state: any) => void) | null;
  onmouseup?: ((state: any) => void) | null;
  onmousemove?: ((state: any) => void) | null;
  onmouseout?: (() => void) | null;
}

class GuacMouse implements MouseHandlers {
  /**
   * The number of mousemove events to require before re-enabling mouse
   * event handling after receiving a touch event.
   */
  touchMouseThreshold = 3;

  /**
   * The minimum amount of pixels scrolled required for a single scroll button
   * click.
   */
  scrollThreshold = 53;

  /**
   * The number of pixels to scroll per line.
   */
  PIXELS_PER_LINE = 18;

  /**
   * The number of pixels to scroll per page.
   */
  PIXELS_PER_PAGE = this.PIXELS_PER_LINE * 16;

  /**
   * The current mouse state. The properties of this state are updated when
   * mouse events fire. This state object is also passed in as a parameter to
   * the handler of any mouse events.
   */
  currentState: any;

  /**
   * Fired whenever the user presses a mouse button down over the element
   * associated with this GuacMouse.
   */
  onmousedown: ((state: any) => void) | null = null;

  /**
   * Fired whenever the user releases a mouse button down over the element
   * associated with this GuacMouse.
   */
  onmouseup: ((state: any) => void) | null = null;

  /**
   * Fired whenever the user moves the mouse over the element associated with
   * this GuacMouse.
   */
  onmousemove: ((state: any) => void) | null = null;

  /**
   * Fired whenever the mouse leaves the boundaries of the element associated
   * with this GuacMouse.
   */
  onmouseout: (() => void) | null = null;

  /**
   * Counter of mouse events to ignore. This decremented by mousemove, and
   * while non-zero, mouse events will have no effect.
   */
  private ignore_mouse = 0;

  /**
   * Cumulative scroll delta amount. This value is accumulated through scroll
   * events and results in scroll button clicks if it exceeds a certain
   * threshold.
   */
  private scroll_delta = 0;

  constructor(element: HTMLElement) {
    // Initialize current state
    this.currentState = new Guacamole.Mouse.State(
      0, 0, 
      false, false, false, false, false
    );

    this.setupEventListeners(element);
  }

  private cancelEvent(e: Event): void {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    (e as any).returnValue = false;
  }

  private setupEventListeners(element: HTMLElement): void {
    // Block context menu so right-click gets sent properly
    element.addEventListener("contextmenu", (e) => {
      this.cancelEvent(e);
    }, false);

    // Mouse handling with proper scaling
    element.addEventListener("mousemove", (e: MouseEvent) => {
      // If ignoring events, decrement counter
      if (this.ignore_mouse) {
        this.ignore_mouse--;
        return;
      }

      // Get the element rect to account for any scaling or positioning
      const rect = element.getBoundingClientRect();
      
      // Calculate the position within the element
      const elementX = e.clientX - rect.left;
      const elementY = e.clientY - rect.top;

      this.currentState.fromClientPosition(element, e.clientX, e.clientY);

      if (this.onmousemove)
        this.onmousemove(this.currentState);
    }, false);

    element.addEventListener("mousedown", (e: MouseEvent) => {
      this.cancelEvent(e);

      // Do not handle if ignoring events
      if (this.ignore_mouse)
        return;

      switch (e.button) {
        case 0:
          this.currentState.left = true;
          break;
        case 1:
          this.currentState.middle = true;
          break;
        case 2:
          this.currentState.right = true;
          break;
      }

      if (this.onmousedown)
        this.onmousedown(this.currentState);
    }, false);

    element.addEventListener("mouseup", (e: MouseEvent) => {
      this.cancelEvent(e);

      // Do not handle if ignoring events
      if (this.ignore_mouse)
        return;

      switch (e.button) {
        case 0:
          this.currentState.left = false;
          break;
        case 1:
          this.currentState.middle = false;
          break;
        case 2:
          this.currentState.right = false;
          break;
      }

      if (this.onmouseup)
        this.onmouseup(this.currentState);
    }, false);

    element.addEventListener("mouseout", (e: MouseEvent) => {
      // Get parent of the element the mouse pointer is leaving
      const target = (e.relatedTarget || (e as any).toElement) as Node;
      
      // Check that mouseout is due to actually LEAVING the element
      let currentTarget = target;
      while (currentTarget) {
        if (currentTarget === element)
          return;
        currentTarget = currentTarget.parentNode;
      }

      this.cancelEvent(e);

      // Release all buttons
      if (this.currentState.left
        || this.currentState.middle
        || this.currentState.right) {

        this.currentState.left = false;
        this.currentState.middle = false;
        this.currentState.right = false;

        if (this.onmouseup)
          this.onmouseup(this.currentState);
      }

      // Fire onmouseout event
      if (this.onmouseout)
        this.onmouseout();
    }, false);

    // Override selection on mouse event element.
    element.addEventListener("selectstart", (e) => {
      this.cancelEvent(e);
    }, false);

    // Ignore all pending mouse events when touch events are the apparent source
    const ignorePendingMouseEvents = () => { 
      this.ignore_mouse = this.touchMouseThreshold; 
    };

    element.addEventListener("touchmove", ignorePendingMouseEvents, false);
    element.addEventListener("touchstart", ignorePendingMouseEvents, false);
    element.addEventListener("touchend", ignorePendingMouseEvents, false);

    // Scroll wheel support
    const mousewheel_handler = (e: WheelEvent) => {
      // Determine approximate scroll amount (in pixels)
      let delta = e.deltaY || -(e as any).wheelDeltaY || -(e as any).wheelDelta;

      // If successfully retrieved scroll amount, convert to pixels if not
      // already in pixels
      if (delta) {
        // Convert to pixels if delta was lines
        if (e.deltaMode === 1)
          delta = e.deltaY * this.PIXELS_PER_LINE;

        // Convert to pixels if delta was pages
        else if (e.deltaMode === 2)
          delta = e.deltaY * this.PIXELS_PER_PAGE;
      }

      // Otherwise, assume legacy mousewheel event and line scrolling
      else
        delta = (e as any).detail * this.PIXELS_PER_LINE;
      
      // Update overall delta
      this.scroll_delta += delta;

      // Up
      if (this.scroll_delta <= -this.scrollThreshold) {
        // Repeatedly click the up button until insufficient delta remains
        do {
          if (this.onmousedown) {
            this.currentState.up = true;
            this.onmousedown(this.currentState);
          }

          if (this.onmouseup) {
            this.currentState.up = false;
            this.onmouseup(this.currentState);
          }

          this.scroll_delta += this.scrollThreshold;
        } while (this.scroll_delta <= -this.scrollThreshold);

        // Reset delta
        this.scroll_delta = 0;
      }

      // Down
      if (this.scroll_delta >= this.scrollThreshold) {
        // Repeatedly click the down button until insufficient delta remains
        do {
          if (this.onmousedown) {
            this.currentState.down = true;
            this.onmousedown(this.currentState);
          }

          if (this.onmouseup) {
            this.currentState.down = false;
            this.onmouseup(this.currentState);
          }

          this.scroll_delta -= this.scrollThreshold;
        } while (this.scroll_delta >= this.scrollThreshold);

        // Reset delta
        this.scroll_delta = 0;
      }

      this.cancelEvent(e);
    };

    element.addEventListener('DOMMouseScroll', mousewheel_handler as any, false);
    element.addEventListener('mousewheel', mousewheel_handler as any, false);
    element.addEventListener('wheel', mousewheel_handler, false);
  }

  /**
   * Whether the browser supports CSS3 cursor styling, including hotspot
   * coordinates.
   */
  private static CSS3_CURSOR_SUPPORTED = (() => {
    const div = document.createElement("div");

    // If no cursor property at all, then no support
    if (!("cursor" in div.style))
      return false;

    try {
      // Apply simple 1x1 PNG
      div.style.cursor = "url(data:image/png;base64,"
                       + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
                       + "AQMAAAAl21bKAAAAA1BMVEX///+nxBvI"
                       + "AAAACklEQVQI12NgAAAAAgAB4iG8MwAA"
                       + "AABJRU5ErkJggg==) 0 0, auto";
    }
    catch (e) {
      return false;
    }

    // Verify cursor property is set to URL with hotspot
    return /\burl\([^()]*\)\s+0\s+0\b/.test(div.style.cursor || "");
  })();

  /**
   * Changes the local mouse cursor to the given canvas, having the given
   * hotspot coordinates. This affects styling of the element backing this
   * GuacMouse only, and may fail depending on browser support for
   * setting the mouse cursor.
   * 
   * If setting the local cursor is desired, it is up to the implementation
   * to do something else, such as use the software cursor built into
   * Guacamole.Display, if the local cursor cannot be set.
   *
   * @param canvas The cursor image.
   * @param x The X-coordinate of the cursor hotspot.
   * @param y The Y-coordinate of the cursor hotspot.
   * @return true if the cursor was successfully set, false if the
   *         cursor could not be set for any reason.
   */
  setCursor(canvas: HTMLCanvasElement, x: number, y: number): boolean {
    // Attempt to set via CSS3 cursor styling
    if (GuacMouse.CSS3_CURSOR_SUPPORTED) {
      const dataURL = canvas.toDataURL('image/png');
      (canvas.parentElement as HTMLElement).style.cursor = `url(${dataURL}) ${x} ${y}, auto`;
      return true;
    }

    // Otherwise, setting cursor failed
    return false;
  }
}

// Attach supporting classes
(GuacMouse as any).State = Guacamole.Mouse.State;
(GuacMouse as any).Touchpad = Guacamole.Mouse.Touchpad;
(GuacMouse as any).Touchscreen = Guacamole.Mouse.Touchscreen;

export default {
  mouse: GuacMouse
};
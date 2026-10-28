import { describe, expect, it } from "vitest";
import { docsHtml } from "../openapi";

describe("docsHtml", () => {
  it("escapes the title and quotes the spec URL", () => {
    const html = docsHtml('/o"x', '<b>"x"&');
    expect(html).toContain("<title>&#60;b&#62;&#34;x&#34;&#38; docs</title>");
    expect(html).toContain('url: "/o\\"x"');
  });
});

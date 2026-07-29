"""Outlook-compatible HTML eDM generation.

Outlook (desktop) uses Microsoft Word's rendering engine, which ignores most
modern CSS. To render reliably we therefore:

* use nested tables for layout (no flexbox / grid),
* inline every style attribute (no <style> or external CSS),
* use fixed pixel widths with a centered 600px container,
* use bulletproof, table-based buttons for the call-to-action,
* keep it responsive-friendly via a max-width wrapper and fluid inner content.

The output is a full HTML document that HR can copy and paste directly into a
new Outlook email; formatting is preserved on paste.
"""

from __future__ import annotations

from html import escape
from typing import Iterable, List

# NParks-inspired palette.
GREEN_DARK = "#1f5c3a"
GREEN = "#2e7d32"
GREEN_ACCENT = "#43a047"
GREEN_SOFT = "#eef6ee"
INK = "#2b2b2b"
MUTED = "#5f6b62"
BORDER = "#dfe8e0"
WHITE = "#ffffff"

FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

HEADER_TITLE = "🌿 Explore Career Opportunities Within NParks"
OPENING_MESSAGE = (
    "Looking for your next opportunity within NParks?<br><br>"
    "Explore our latest internal openings across the organisation. "
    "If a role interests you, have a conversation with your HR Business "
    "Partner before applying through Careers@Gov."
)
FOOTER_MESSAGE = (
    "Interested in exploring a different career pathway within NParks?<br>"
    "Speak with your HR Business Partner before submitting your application "
    "through Careers@Gov."
)


def _card_html(title: str, division: str, closing_date: str, summary: str, apply_url: str) -> str:
    """Render a single vacancy as a rounded card (table-based)."""
    title = escape(title or "")
    summary = escape(summary or "")
    apply_url = escape(apply_url or "https://www.careers.gov.sg/", quote=True)

    meta_rows: List[str] = []
    if division:
        meta_rows.append(
            f'<span style="color:{GREEN_DARK};font-weight:bold;">Division:</span> '
            f'<span style="color:{MUTED};">{escape(division)}</span>'
        )
    if closing_date:
        meta_rows.append(
            f'<span style="color:{GREEN_DARK};font-weight:bold;">Closing date:</span> '
            f'<span style="color:{MUTED};">{escape(closing_date)}</span>'
        )
    meta_html = "&nbsp;&nbsp;•&nbsp;&nbsp;".join(meta_rows)

    return f"""
    <tr>
      <td style="padding:0 0 20px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background-color:{WHITE};border:1px solid {BORDER};border-radius:12px;border-collapse:separate;">
          <tr>
            <td style="padding:22px 24px 22px 24px;border-left:4px solid {GREEN_ACCENT};border-radius:12px;">
              <p style="margin:0 0 6px 0;font-family:{FONT};font-size:18px;line-height:24px;font-weight:bold;color:{GREEN_DARK};">
                {title}
              </p>
              <p style="margin:0 0 12px 0;font-family:{FONT};font-size:13px;line-height:18px;">
                {meta_html}
              </p>
              <p style="margin:0 0 18px 0;font-family:{FONT};font-size:15px;line-height:22px;color:{INK};">
                {summary}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="{GREEN}"
                      style="border-radius:8px;background-color:{GREEN};">
                    <a href="{apply_url}" target="_blank"
                       style="display:inline-block;padding:11px 22px;font-family:{FONT};font-size:14px;
                              font-weight:bold;color:{WHITE};text-decoration:none;border-radius:8px;">
                      Apply on Careers@Gov &nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    """


def build_edm_html(vacancies: Iterable[dict]) -> str:
    """Build the full Outlook-compatible eDM document.

    Parameters
    ----------
    vacancies:
        Iterable of dicts with keys: title, division, closing_date, summary,
        apply_url. Only the vacancies passed in are rendered (the caller is
        responsible for filtering hidden ones and ordering).
    """
    cards = "".join(
        _card_html(
            v.get("title", ""),
            v.get("division", ""),
            v.get("closing_date", ""),
            v.get("summary", ""),
            v.get("apply_url", ""),
        )
        for v in vacancies
    )

    if not cards:
        cards = f"""
        <tr><td style="padding:0 0 20px 0;font-family:{FONT};font-size:15px;color:{MUTED};">
          There are no open vacancies to display at the moment. Please check back soon.
        </td></tr>
        """

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Explore Career Opportunities Within NParks</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a {{ font-family: Arial, sans-serif !important; }}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:{GREEN_SOFT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:{GREEN_SOFT};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!-- 600px container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;background-color:{WHITE};border-radius:16px;border-collapse:separate;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:{GREEN_DARK};padding:32px 28px;border-top-left-radius:16px;border-top-right-radius:16px;">
              <p style="margin:0;font-family:{FONT};font-size:24px;line-height:30px;font-weight:bold;color:{WHITE};">
                {HEADER_TITLE}
              </p>
            </td>
          </tr>
          <!-- Opening message -->
          <tr>
            <td style="padding:26px 28px 8px 28px;font-family:{FONT};font-size:15px;line-height:23px;color:{INK};">
              {OPENING_MESSAGE}
            </td>
          </tr>
          <!-- Cards -->
          <tr>
            <td style="padding:18px 28px 8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                {cards}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:8px 28px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:{GREEN_SOFT};border-radius:12px;padding:20px 22px;
                             font-family:{FONT};font-size:14px;line-height:21px;color:{GREEN_DARK};">
                    {FOOTER_MESSAGE}
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0;font-family:{FONT};font-size:11px;line-height:16px;color:{MUTED};text-align:center;">
                This is an internal communication from the NParks HR team to support internal mobility.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

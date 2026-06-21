"""Curated generic wisdom entries seeded into each new user's knowledge base.

These give a cold-start corpus so a user can ask meaningful questions before
writing anything of their own. Each is stored with group "Generic" and tagged
so it can be filtered out from a user's personal thinking later.
"""

GENERIC_GROUP = "Generic"

GENERIC_ENTRIES = [
    {
        "title": "On making hard decisions",
        "content": (
            "Separate reversible decisions from irreversible ones. Reversible "
            "decisions should be made fast and cheaply — you can always undo them. "
            "Irreversible ones deserve more care. When stuck, ask how you'll feel "
            "about this choice in 10 minutes, 10 months, and 10 years; the time "
            "horizons usually reveal what actually matters. And remember that not "
            "deciding is itself a decision, often the most expensive one."
        ),
        "tags": ["decisions", "thinking"],
    },
    {
        "title": "On building habits that last",
        "content": (
            "Start absurdly small — so small it feels almost pointless. Two "
            "push-ups, one sentence, one page. Consistency compounds; intensity "
            "burns out. Attach the new habit to something you already do daily "
            "(after coffee, I write one line). Don't break the chain, and when you "
            "do, never miss twice. Identity drives behavior: become the kind of "
            "person who does this, rather than chasing a one-off goal."
        ),
        "tags": ["habits", "growth"],
    },
    {
        "title": "On learning anything faster",
        "content": (
            "Recall beats re-reading. Close the book and try to explain the idea "
            "from memory — the struggle is where learning happens. Teach it to "
            "someone (or to an empty room); gaps in your understanding surface "
            "instantly. Space your practice over days instead of cramming, and mix "
            "related topics rather than drilling one in isolation. Confusion is not "
            "failure; it's the feeling of your brain rewiring."
        ),
        "tags": ["learning", "growth"],
    },
    {
        "title": "On money and the long game",
        "content": (
            "Spend less than you earn and invest the difference — everything else "
            "is detail. Pay yourself first by automating savings before you can "
            "spend them. Time in the market beats timing the market; compounding "
            "rewards patience, not cleverness. Avoid lifestyle creep: when income "
            "rises, bank most of the raise. Debt at high interest is an emergency; "
            "kill it before you invest."
        ),
        "tags": ["money", "finance"],
    },
    {
        "title": "On focus and deep work",
        "content": (
            "Your attention is the scarcest resource you have. Do the most "
            "important thing first, before the world wakes up and starts making "
            "requests. Single-task — switching costs are real and invisible. "
            "Remove friction from good work and add friction to distraction: put "
            "the phone in another room. Protect long, unbroken blocks of time; the "
            "best thinking rarely happens in fifteen-minute slivers."
        ),
        "tags": ["focus", "productivity"],
    },
    {
        "title": "On handling failure and setbacks",
        "content": (
            "Failure is information, not a verdict on your worth. Separate the "
            "outcome from your identity — you ran an experiment that didn't work, "
            "you are not a person who is a failure. Ask what specifically went "
            "wrong and what you'd change, then move. Most people overestimate the "
            "cost of a setback and underestimate their ability to recover. The only "
            "real failure is refusing to learn from it."
        ),
        "tags": ["resilience", "growth"],
    },
    {
        "title": "On time and priorities",
        "content": (
            "Urgent and important are not the same thing — most urgency is someone "
            "else's, not yours. Decide your few important things and defend the "
            "time for them ruthlessly. Saying no to the good is how you protect "
            "room for the great. Batch shallow tasks together. And notice that a "
            "full calendar is not the same as a meaningful one."
        ),
        "tags": ["time", "productivity"],
    },
    {
        "title": "On relationships and trust",
        "content": (
            "Listen to understand, not to reply — most people just want to feel "
            "heard. Assume good intent; the story you invent about why someone "
            "acted is usually harsher than the truth. Show up consistently in small "
            "ways; reliability builds more trust than grand gestures. Repair "
            "quickly after conflict. And remember that you become like the people "
            "you spend the most time with, so choose them deliberately."
        ),
        "tags": ["relationships", "trust"],
    },
    {
        "title": "On stress and staying steady",
        "content": (
            "Control what you can control and release the rest — most anxiety lives "
            "in the gap between the two. When overwhelmed, shrink the problem to the "
            "single next action. Sleep, movement, and sunlight do more for your "
            "mood than any productivity hack. Breathe slowly to tell your body it's "
            "safe. And zoom out: almost nothing you're worried about today will "
            "matter in five years."
        ),
        "tags": ["stress", "wellbeing"],
    },
    {
        "title": "On creativity and ideas",
        "content": (
            "Quantity is the path to quality — make a lot, and the good work emerges "
            "from the volume. Capture ideas the moment they appear; the faintest "
            "pencil beats the sharpest memory. Creativity is mostly connecting "
            "things that already exist, so feed your mind widely. Lower the stakes "
            "of starting; you can always edit a bad first draft, but you can't edit "
            "a blank page."
        ),
        "tags": ["creativity", "ideas"],
    },
]

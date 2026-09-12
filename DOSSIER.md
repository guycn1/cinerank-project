# DOSSIER.md

The content of this file has been copied from the course's moodle page.

## Purpose

This course teaches agentic software engineering: the craft of building software by directing AI agents and checking what they produce, rather than by typing most of the code yourself. Over the past few years the centre of software work has moved. Where a developer once wrote code line by line, the same developer now frames a problem, briefs an agent, and judges what comes back. The typing is increasingly the agent's job. The thinking, the framing, and the judging stay human, and they are what this course builds.

The shift is real, not hype, and the evidence does not reward wishful thinking. Agents now produce code at a speed no human team can match, yet much of that code is not ready to ship. A large share of agent-written changes sit unreviewed or delayed, and apparent fix rates on real bugs fall sharply once the work is checked with care. This is the gap the course is built around: speed is easy, trust is hard. The difference between a professional and an amateur holding the same agent is not skill at prompting. It is the presence or absence of structure around the agent's work.

That structure is the discipline, and the course gives it a simple shape. A casual user gives an agent an instruction and hopes. An engineer equips the agent and verifies the result. Equipping means the right problem, the right spec, the right context, the right tools and limits. Verifying means checking the output against a clear standard before accepting it. Every part of the course is one piece of equipping or one piece of verifying.

The course teaches a discipline, not a single tool, and the distinction matters. Tools change every year. The way a human and an agent work together to build good software changes slowly, because it rests on older ideas about specification, design, and review that have held for decades. So you will learn methods that outlast this year's products. Learn only today's tool and you will need a new course within a year. Learn the discipline and you can pick up next year's agent and use it well.

The path through the course follows the shape of the work itself. You begin with the discipline and the mindset: what changed, what stays human, how agents really work, and what a sound workflow looks like. You then move to the setting in which the work happens: framing intent, the architecture of the systems you build, and the economics of products that contain intelligence. The heart of the course is the engineering: writing specifications and running the spiral that revises them, engineering context, keeping work safe and recoverable, verifying before trust, coordinating several agents, reviewing code you did not write, and handling security. The course closes on the market the discipline opens onto.

By the end you will be able to frame a problem, write a spec an agent can act on, set up the agent's context and limits, verify and review what it builds, and run a project across several turns of improvement. You will be ready to work in teams that have adopted these workflows, and to weigh new agentic tools with a clear eye as the field keeps moving.

## Grading rules

These rules state what the course grades, what evidence it grades, how the three components are weighed, and how a grade is reached. Read them at the start of the term. They are the whole agreement. Nothing outside them is graded, and nothing inside them is negotiable after the fact.

### The one thing to understand first

The course grades your demonstrated ability to direct an agentic development environment. It does not grade the app you produce. Two students can ship the same working product and earn different grades, because the grade follows the discipline you show while directing the agent: how you frame the problem, how you write the specification, how you engineer context, how you design verification, how you review the agent's output, how you coordinate agents, and how legible you leave the trail.

A second point follows from the first, and it is the one that causes most disagreement, so it is stated here at the top. **The grade you can defend, by pointing to the specifications and your own evidence, runs up to 90**. Grades above that, up to 97, are obtainable, but they rest on my judgement of quality rather than on a checklist you can complete. **The last band, 98 to 100, is for exceptional extra effort and is not guaranteed to anyone**.

### What counts as evidence

I grade only what I can read and verify. The repository is the record. What lives in it at the deadline is your work; what does not is not graded, however real it was.

This means the following count: your commit history, your context files such as `CLAUDE.md` and memory and lessons-learned notes, your specifications and charge sheets, your agent prompts, your verification gates and their results, your folder structure, your readme, and what you demonstrate and ask in the sessions.

And the following do not count, for anyone, ever: a video of a running app, a verbal account of what you did, files stored outside the repository, a repository re-created after the fact with its history lost, and work you describe but did not commit by the deadline. I am one person and I can only grade what I can open and check. This is not distrust. It is the only fair rule, because it applies the same way to everyone.

### The three components

The grade is three equal thirds:

* 33% - Class engagement.
* 33% - The running project that we build together across the sessions.
* 33% - Your own project, the independent application you frame and build.

Each third is graded against the specifications below. Each third uses the same grade bands.

### How each third is graded

**Class engagement.** Attendance is not what is required here. Engagement is. The two are not the same, and the difference is the point of this third.

We record attendance with a sheet filled at every lesson. Class begins five minutes after the scheduled time, and the sheet is closed thirty-five minutes after the scheduled time, so arrive within that window if you want the day marked. If you have to miss a class, tell me in advance. But being in the room is only one way to show engagement, and presence itself is not the thing I grade.

What I grade is whether you did the work of the course and let me see it. The fullest path is plain. Read the whole textbook, perform all the exercises, build the running project, and find the occasions to inform me that you have done so. A student who does all of that has earned 100 on engagement, whether or not they filled every attendance sheet. Alongside that, engagement shows in the ordinary ways you already know as a third-year student: asking and answering substantial questions, demonstrating your own workflow live when asked, and sending me what you find as you follow the field, a paper or a tool or an argument with a line on why it matters. This is written down only so the grade is not a matter of my mood.

**Both projects.** The two projects are graded the same way, on the same discipline, so what follows holds for each. I grade the trail, not only the finished build. Two things count in their own right: keeping the work on schedule, moving with the module beats and reaching each checkpoint on time, and keeping the work documented as you go, so the trail is written during the build and not assembled at the end. A build that arrives late, or whose trail is retrofitted, loses marks even when the final artefact is sound. Beyond that, I grade the context files kept and maintained across sessions, the commit history that shows the process with commits made before agent invocations and honest atomic messages, the verification gates that must catch real failure modes rather than nothing, and a final state left merge-ready. On all of it, present and competent places you in the defendable range up to 90; quality clearly beyond the minimum reaches higher, and the last points are for exceptional work.

**The running project** differs only in its specification, which is fixed and shared: the panel, the protocol that refuses to combine the verdicts, the charge sheet, the cases, and the models reached through OpenRouter. Each of you builds your own application around that essence, in your own repository — one specification, many individual builds — which gives me a clean yardstick to compare you against. What is specific here is that the charge sheet must be written precisely as a specification and not free text, the seven agent prompts must be written and versioned, the protocol must report the three verdicts side by side without combining them, and the progression from one model toward several must be visible as far as you carried it.

**Your own project** differs in that the specification is yours. It is an independent application of your own design and subject, framed in the discipline Module 6 teaches, and it runs in parallel with the running project on the same module beats: when we frame the running project, you frame this; when we specify, verify, review, and audit it, you do the same for yours the same week. The domain you choose, trading or anything else, neither raises nor lowers the grade, and neither does surface polish. What is specific here is the framing document, with its problem statement, testable definition of done, and out-of-scope list, and a commit history across at least three full turns of the spiral.

### What the numbers mean

The scale has three thresholds, and they are the heart of these rules.

A grade up to 90 is defendable by you. It rests on the specifications and the evidence in your repository, so you can point to it, and if you believe it was misjudged you can argue it. Doing everything the course asks, competently, lives in this range.

A grade up to 97 is obtainable. It is reachable for work of clear quality beyond the minimum, but it rests on my judgement rather than on a checklist, so it is earned, not claimed.

A grade from 98 to 100 is for exceptional extra effort. It is not guaranteed to anyone, it is awarded by comparison against the strongest work in the class, and no amount of completing requirements produces it. Most work that is complete and competent lands below it, and that is the design, not a shortfall.

### Submission

Everything is graded from the repository as it stands at the deadline. Keep one repository per project and let its history stand as your record; do not re-create it. Commit as you work, so the trail exists before you need it. The agent writes the code, and that is the course, not something to confess.

### Schedule

I will publish your grades no later than ten days after the day of the final class. If you disagree with a grade, you may ask for one regrade, in writing, within seven days of receiving it. Point to the specifications and the evidence in your repository that you believe was misjudged. Because the defendable range runs up to 90, that is the range a regrade operates in: a grade there can be checked against your evidence and corrected if I erred. Grades above 90 rest on judgement and extra effort, not on a checklist, so they are not moved by a wish for more points. I will look again once, and the second grade stands. This channel exists so that a real error can be corrected, not as a negotiation.

## House rules

### Attendance

Sessions are taught live, in person, on campus. Attendance is recorded.

In special situation we will go on Zoom, and I will demand that you keep your camera on for the whole session and your names in English.

### Email

You are welcome to email me at ********, and you can expect a reply within 3-4 days. Using an AI to help draft your email is fine; this is, after all, a course about working with agents. What you send is still yours: read it before sending, make sure it says what you mean, and keep it short and clear.

**Important:** Make sure you receive course emails, as throughout this course I will send you important messages — grades, deadlines, and announcements from ********.

To make sure these never land in your Spam folder, please take one minute now to add me to your safe senders. Please do this in the first week. Some course emails are time-sensitive, and I cannot be responsible for messages that go to your Spam folder because my address wasn't added.

### Our toolbox

The course runs on a shared set of tools, and you should have them set up before term starts.

Claude Code as the ADE (agentic development environment) - standalone app or, better, in terminal. GitHub to store and version your code, Netlify to deploy and host your web app, and Supabase for a backend with a database, authentication, and storage.

These are recommendations, not requirements. They suit the kind of small web product you will build, they work smoothly with agents, and they are free to start. If you already prefer equivalent tools, use them; nothing in the course depends on this exact set. Whatever you choose, set up your accounts before term starts, so session time goes to the work and not to setup.

**A note on Claude Code:** Claude Code is the standard environment we teach on, chosen so everyone works against the same reference and the sessions stay concrete. It is not the only option, and naming it is a teaching choice, not an endorsement or a paid promotion. If you prefer a comparable agent and can keep pace with the course on it, you are free to use it. The discipline you learn here carries across tools, which is the whole point.

## Course modules

### Moudle 1: What is Agentic Software Engineering?

This module explains what changed, and why the change is a shift in discipline rather than in tooling. It sets agentic engineering in its own history: rule-based systems, then statistical machine learning, then transformers, and at last the agent loop. Across that arc the work moves from writing code to directing a workflow. The history matters because a shift that feels sudden in fact had a decade of preparation behind it, and a student who sees the preparation can read where the trajectory points next.

The central claim is blunt. What separates professional from amateur use of agents is not skill at prompting but the presence or absence of structure. Research on agent-generated code makes this concrete. More than 68% of agent-written pull requests sit delayed or unreviewed in practice, and apparent success rates on real bugs fall sharply once an audit gets rigorous, dropping from impressive headline figures to a small fraction. Agents produce code at a speed no human team can match, much of it is not ready to merge, and at high volume the surplus buries the developers who must review it. That is the speed-versus-trust gap, the defining tension of the present moment, and the problem the rest of the course is built to address.

To give students a precise vocabulary, the module lays out levels of autonomy for software engineering, running from manual coding through task assistance and goal assistance to specialised and then general domain autonomy. The framework names where each tool sits today and what the next level would actually demand. It closes on the distinction the whole course turns on. A casual prompter gives an instruction and hopes. An engineer equips the agent with the right problem, context, and limits, then verifies the output against a defined standard. Every later module is one part of equipping or one part of verifying.

### Module 2: The human role. What erodes and what compounds.

This module asks a hard question and refuses to answer it by speculation: what stays irreducibly human as the models improve, and what quietly erodes. The answer rests on data. Anthropic's own research finds developers using AI in roughly 60% of their work, yet able to fully hand off only a small share of tasks. The apparent contradiction dissolves once effective collaboration is understood as active human participation rather than passive oversight.

From there the module sorts developer work into three groups. Some of it erodes: routine implementation of well-defined tasks, boilerplate generation, pattern-matching across large codebases, and documenting behaviour already known. Some of it holds steady: debugging novel failures, weighing ambiguous trade-offs, and navigating an organisation. Some of it compounds: framing the problem, designing the system, taste, the expertise to judge what an agent hands back, and the capacity to decide what is worth building at all. Students should pour their effort into the third group, because it grows more valuable exactly as the first one shrinks.

Accountability fills the second half. In agentic engineering the human carries responsibility for the output no matter who, or what, produced it. Acceptance criteria, the definition of done, and the bar the work must clear are human responsibilities, and none of them can be passed to the agent. A team that forgets this ships whatever the agent happened to produce and calls it a decision. The module ends in practice, not theory. Students audit their own current skills against the three groups, mark where each of their habits falls, and decide where the next year of effort should go. The exercise is uncomfortable on purpose: most people discover they have been investing hardest in precisely the work that is eroding fastest beneath them.

### Module 3: Mental models of agents.

This module describes how agents actually work, at the level of precision a practitioner needs to direct them rather than guess at them. The aim is to make agent behaviour readable instead of mysterious, and its failures foreseeable instead of shocking. Begin with the context window. For the length of a session it is the agent's entire world: the project, the instructions, the conversation so far, the file contents, and the tool outputs, all packed into a fixed token budget, with nothing remembered outside it unless the engineer puts it there. This is why context engineering is structural rather than optional. A poorly assembled context does not leave the agent merely short of information, it feeds the agent wrong information dressed up as complete.

Tools are how the agent acts on the world, reading and writing files, running shell commands, searching the web, calling an API. The set of tools on hand defines its action space entirely; an agent with no write tool can advise but cannot build. Planning is how the agent breaks a complex task into steps, and a plan is only as sound as the context behind it, yet the agent plans with the same confidence whether it is right or wrong.

The sharpest part of the session is the catalogue of failures. Hallucination invents plausible-sounding falsehoods. Misalignment solves the wrong problem from intent that was too thin. Ambiguity collapse takes an underspecified instruction and picks one reading in silence, as if the others never existed. Sycophancy agrees with a human who is mistaken, because agreement was the rewarded behaviour during training. Each failure has its own root cause and its own remedy, so a student who can name the mode can reach for the fix. The jagged frontier closes the session, and it is what makes calibration the human skill that matters most.

### Module 4: The anatomy of an agentic workflow. From coding to engineering.

This module takes a whole agentic workflow apart and names its parts: intent, specification, context, plan, execution, verification, and the audit trail. The vocabulary is the point. Once a student can name the stages, any failure, the agent's or their own, can be traced to the stage where it began, instead of being blamed vaguely on the agent. The session then states the commitment that turns this vocabulary into a discipline. A workflow that cannot be inspected, replayed, or judged after the fact is not engineering, it is craft.

The line between the two carries real weight. Engineering is accountable and reproducible; craft produces a result and leaves no account of how. A workflow that yields an output but no trace of its making cannot be improved, cannot be audited, and cannot be trusted past the moment it ran. What rescues it is the audit trail: a frozen record that links intent to specification, specification to context, context to the agent's trajectory, and trajectory to the final output. That record is the difference between engineering and sophisticated guesswork.

The session also places itself inside the course as a whole. The workflow is the map, and almost every later module is a close study of one stage on it. Module 6 takes up intent. Module 10 takes up specification. Module 11 takes up context. Module 13 takes up verification. Modules 14 and 15 deal with the cases where a single agent is not enough and execution has to be spread across several. Seeing the entire shape before going deep into any one part is what keeps the parts coherent, and it is why this module comes early rather than late.

### Module 5: The ADE typology. Tooling and permissions.

This module gives students a way to read any agentic development environment as an instance of a type rather than a fresh mystery to learn from scratch. The frame is a six-pillar architecture: the bare language model, tool augmentation, knowledge and memory, learning from experience, multi-agent coordination, and computer use. Any ADE can be described by which of these pillars it implements and how.

The session then sorts environments into three families, each built on a different stance toward transparency and control. Terminal and command-line agents expose the agent loop in the open, hand the developer maximum control over context and permissions, and compose with other shell tools; transparency is their design value. IDE-integrated agents fold the model into the editor the developer already lives in, trading some visibility for less friction. Browser-based builders hide almost the entire architecture and optimise for speed of creation. Every one of these choices about transparency is also a choice about where human responsibility is exercised, because a developer who cannot see what the agent is doing has no way to verify it.

Permission design and sandboxing follow, treated as engineering decisions rather than settings to click through. The tools an agent can reach define its blast radius, the scope of harm if it acts wrongly. The governing principle is minimal footprint: grant only the permissions the task requires, prefer reversible actions to irreversible ones, and do less when uncertain. The session ends with a habit students will use for years. Faced with any new ADE, they read it through the typology, name the pillars it implements, judge the transparency it offers, and state plainly what residual responsibility still sits with the human. The tool will keep changing; the way of reading it will not.

### Module 6: Intent and the discipline of problem framing.

Most failed agentic work fails before any agent is ever called, because the problem was framed badly or not framed at all. The agent receives a thin instruction, makes confident guesses about what was meant, and builds something coherent that nobody wanted. From this observation the module makes its case: problem framing is the first and most consequential thing a human contributes to any agentic workflow.

The session refuses to treat framing as common sense and grounds it in real literature. Polya's How to Solve It puts understanding the problem ahead of any attempt at a solution. Donald Schon's work on reflective practice shows that expert practitioners reframe as they go, discovering that what looked like one problem is in fact another. Design thinking turns this into a named phase with named outputs.

Those outputs are taught here as concrete artefacts, not attitudes. A problem statement describes the situation rather than the fix. A stakeholder list names who is affected and how. A definition of done is specific enough to be tested against. An out-of-scope list says plainly what will not be built. Each one does a job for the agent. The problem statement tells it what success looks like. The stakeholder list shapes the trade-offs it is allowed to make. The definition of done gives it a condition for stopping. The out-of-scope list keeps it from wandering off to solve adjacent problems no one asked about. Taken together they convert a vague wish into a brief an agent can act on without guessing. The session ends in production, not discussion. Each student writes a complete framing document for their own project, and most discover that the hardest part is not the agent at all, it is deciding what the problem actually is.

### Module 7: Modern web application architecture.

This module teaches the shape of a modern web application at the level a director needs, not a builder. It is a mental-model session, not a programming course. The reasoning is simple: a developer who does not know what a server does cannot give an agent a coherent instruction to build one, and a developer who cannot tell client-side rendering from server-side rendering cannot judge what the agent hands back.

So the session walks the full stack as ideas rather than syntax. What runs in the browser, and why. What a backend API is for, and why frontend and backend are kept apart in the first place. What a database provides, and what the alternatives to it are. What deployment actually means, and what the services that perform it really do behind their dashboards. None of this is taught so students can write it; it is taught so they can specify it and check it.

The spine of the whole session is the request cycle, traced from end to end and slowly enough that every step earns a name. A user clicks a button. A request travels to a server. The server queries a database. A response returns and the screen changes. Each hop is made visible, because the hops are where agents make mistakes and where review has to happen. A student who can follow a single request through the entire cycle can then direct an agent to build any part of it, debug it when it breaks, or extend it without fear. The session deliberately resists depth for its own sake. It would rather a student hold the whole loop clearly in mind than memorise the details of any one framework, because frameworks change every year while the cycle itself has stayed the same for two decades.

### Module 8: Interface design and app documentation.

The thread running through this module is legibility: the property that makes a system, whether an interface, a codebase, or a document, readable and judgeable by someone who did not build it. In agentic engineering legibility is not a comfort, it is a control mechanism. An illegible interface cannot be directed with any precision. An illegible codebase cannot be reviewed. An illegible document cannot be audited. The human's ability to stay in the loop rests on how legible the agent's output is.

Interface design is taught here as a directing skill, not a matter of taste. When a developer tells an agent to build a screen, the quality of the instruction decides the result, not the agent's aesthetic sense. An instruction that fixes the layout, the hierarchy, the interaction model, and the mental model the user should form yields a legible interface. An instruction that says "make it look good" yields whatever the training data treats as ordinary. The session breaks a precise specification into parts that can each be decided on purpose: the user flow, the information hierarchy, the interaction model, and the feedback design.

Documentation gets the same treatment, as an artefact with an audience and a purpose. Agents generate documentation by default, drawn from code, commits, and trajectory files, but that output describes what the code does and stays silent on why it was built that way or what a future maintainer must know first. The session separates descriptive documentation, which agents produce well, from explanatory documentation, which needs human direction. Students learn to commission documentation as a brief that names audience, purpose, required sections, and the decisions the text must explain. The exercise asks for two directing documents for their own project: an interface brief for one screen, and a documentation brief for one component. Both are written to direct an agent, not to flatter a reader.

### Module 9: Cognified products and the architecture of intelligence in software. Agent economics.

This module turns on a distinction the rest of the course mostly sets aside: the difference between using AI to build software and building software that has AI inside it. Most modules deal with the first. This one deals with the second, with products where the intelligence of a language model is part of what the user is paying for, not just part of how the thing was made.

Once intelligence becomes a component, a new set of architectural questions appears. Where does inference happen? What latency can the user tolerate? How is the model prompted, and by what? What happens when the model is wrong, and who is responsible when it is? These questions have no real counterpart in traditional software architecture, and a student who has never faced them will design cognified products that fail in recognisable ways: too expensive, too slow, unreliable at exactly the wrong moments, and almost impossible to debug.

Agent economics is taught with real numbers, because cost here is a design constraint and not an afterthought. The session covers token pricing across providers, the effect of prompt caching on repeated context (an optimisation people routinely misread), and the choice between frontier models and smaller local ones. Frontier models earn their cost on hard reasoning and judgement. Smaller models win on high-frequency, well-defined tasks where latency and price dominate. In most production systems the latency budget, the response time a given interaction can bear, settles the model choice more firmly than raw capability does. The session leaves students able to reason about an intelligent product as an architecture with a bill attached, rather than a clever demo that quietly becomes unaffordable the moment real users arrive.

### Module 10: Specifications and co-evolution spiral.

In agentic engineering the code is the agent's output, but the specification is the human's. A specification is not a feature list; it is a precise document that gives the agent enough to make its own decisions correctly, so the human need not step in at every turn. This module pairs two things on purpose: writing the specification, and running the rhythm that revises it. The session works through what a complete specification holds and why each part earns its place: the goal and its business rationale, success criteria that can be checked rather than admired, architectural guidance that points without dictating, a validation approach, and the known pitfalls an experienced developer would flag. Knuth's five criteria stand as the formal benchmark a natural-language briefing aims at without reaching.

It then lines specification gaps against agent failures: leave out success criteria and the agent stops when the code runs, not when it works; leave out the business rationale and it betrays the intent; leave out architectural guidance and it picks an approach that is structurally fine and contextually wrong. The reverse interview, prompting the agent to ask questions until it could write the specification itself, surfaces the assumptions the developer did not know they held.

The second half establishes that a specification is never final. Requirements emerge from attempted solutions, so the first spec is the opening turn of a spiral, not a fixed contract. The Lufthansa Flight 2904 case anchors the stakes: the braking system followed a spec that described a normal landing correctly and reality wrongly, and people died. Drawing on Boehm, Brooks, and Cross and Dorst, the session develops the co-evolution of problem and solution, the spiral that runs fast inside a turn and pins intent at named commit points between turns, and two judgment skills taught nowhere else: the commit point, deciding what to lock, and drift detection, reading when the spiral is failing.

### Module 11: Context engineering. The agent's briefing.

Context is not whatever the agent happens to bump into; it is what the engineer deliberately places in front of it. The session treats context engineering as a discipline in its own right, with principles, artefacts, and failure modes worth naming. The first idea is that context is a budgeted resource. The token window is finite, attention quality sags toward the end of a long context, and the kitchen-sink habit of supplying everything that might be relevant measurably makes the agent worse. The real task is curation: deciding what this agent needs to know for this task, and what should be left out because it adds noise rather than signal.

The second idea is that context is a designed artefact. Files such as `CLAUDE.md` and `AGENTS.md` carry project knowledge from one session to the next, briefing the agent before any task begins on what the project is, which conventions to follow, which tools to use, and what to avoid. A recent finding makes the design rule sharp. Human-written context files improve agent performance by roughly 4%, while files the model writes for itself cut performance by about 3% and raise token cost by more than 20%. The implication is blunt: a developer who asks the agent to write its own `CLAUDE.md` is degrading the very system they meant to equip.

The third idea is that context is a maintained system. These files are not written once and forgotten; they have to change as the project changes, as tools come and go, as conventions shift. Maintaining them is part of the job. Bad context is the steady, dominant cause of bad agent output over time, and the danger is that it rots in silence. The agent never announces that its briefing has gone stale; it simply keeps acting on it.

### Module 12: Safety, control, and recovery.

Agents act on the world through tools, and tools leave marks. A file the agent overwrites cannot be restored without a record of what was there before. A shell command leaves state behind. A changed database record reaches everything that reads from it. The session draws the obvious engineering conclusion: safety infrastructure is not a precaution to add later, it is what lets you work fast without risking catastrophic loss.

Git remains the primary safety layer, even though modern environments ship their own checkpoints. Claude Code and its peers snapshot before each edit and offer rewind, which is useful, but only within one session. Across sessions and between collaborators, Git is the audit trail that persists, the history a human can read and independently verify, and the only thing that satisfies the auditability a Merge-Readiness Pack demands. An incident from April 2026 makes the point: Claude Code's worktree auto-cleanup silently deleted work a developer expected to keep. Tool-native safety failed at the moment it was trusted. The lesson is not to drop the tool but to keep a safety layer that does not depend on the tool being correct.

A few Git practices carry most of the weight. Commit before turning an agent loose on anything non-trivial, so there is a clean point to return to. Keep commits atomic, each one a single logical change with a message that says why, so the agent's path stays readable afterwards. Use branches so output can be judged before it touches the main line.

The harder skill is trajectory management, which no tool performs for you. When the agent starts assuming things it did not flag, touching files it was not asked about, and writing longer explanations around smaller results, the session is drifting. Recognising that, and resetting or narrowing or abandoning in time, is human judgement. The session draws the line clearly: technical recovery restores state, which Git handles, while trajectory management notices when the direction itself is wrong, which no tool will notice for you.

### Module 13: Verification before trust.

Every agent output is a hypothesis until something checks it. The session builds verification into the spine of the discipline, the commitment that makes agentic engineering trustworthy and not merely quick. Verification is not one technique but a whole category: tests, type checks, linters, manual review, and acceptance gates, each catching a different kind of failure.

The governing rule is plain. No agent output enters the project without passing a defined gate. What that gate checks, accepts, and rejects is itself an engineering design, not a default. A gate that checks syntax but not behaviour hands out false assurance. A gate that checks behaviour but ignores security simply moves the blind spot somewhere else.

The session then names three failure modes that make verification harder than it sounds. The first is self-confirming tests. Agents write tests that ratify their own implementation, and the tests pass because the same system that wrote the code wrote the checks, carrying the same assumptions into both. The second is verification theatre: gates that exist and catch nothing, kept alive because they look rigorous while doing no real work. The third, and the most common in practice, is gate bypass under deadline pressure, where the gate is stepped around because the output looks right and the clock is loud. Each of these is a way of feeling safe without being safe, which is worse than knowing you are exposed.

To give students a standard solid enough to resist all three, the session introduces the Merge-Readiness Pack, a structured framework of five criteria, each with explicit evidence requirements. Here it is named and sketched; the full treatment waits for Module 16. The point students leave with is simple to say and hard to live: speed without a gate is not engineering, it is hope.

### Module 14: Multi-agent decomposition and orchestration.

Every modern environment already runs multi-agent orchestration inside itself. When a developer puts Claude Code or Cursor onto a non-trivial task, the tool is already spawning subagents, firing parallel tool calls, and running evaluator loops, all without being asked. So the distinction that matters is not single-agent against multi-agent. It is implicit orchestration, where the tool handles decomposition on its own, against explicit orchestration, where the developer designs the decomposition because the tool's internal handling does not fit the task's shape.

The session teaches decomposition as the activity that decides whether explicit orchestration succeeds: how to split a task into sub-tasks with clear boundaries, how to tell what can run in parallel from what must run in sequence, and how to isolate context so each agent works in a clean scope without polluting the others. Context isolation, giving each subagent its own full window, is the real source of the performance gains, not architectural cleverness; Anthropic's research finds that token usage explains 80% of the variance in performance.

Five workflow patterns supply the vocabulary. Prompt chaining for fixed sequential steps. Routing for tasks where the input type picks the specialist. Parallelisation, by sectioning for independent subtasks or voting for consensus, where parallel work genuinely helps. Orchestrator-workers for tasks where a coordinator must direct specialists as it learns. Evaluator-optimizer for tasks with definable quality criteria and room for iterative refinement.

N-version programming arrives as a counterintuitive use of parallelisation: run four agents on the same task, keep the best, and the metric shifts from latency to throughput while creative exploration becomes routine. Cost frames every one of these choices, because multi-agent workflows burn roughly fifteen times the tokens of a standard interaction. Explicit orchestration is right when the quality gain clears that cost, and never otherwise.

### Module 15: Designing multi-agent workflows.

This module moves from knowing the patterns to putting them to work, and it treats that move as a design discipline rather than a technical drill. Students learn to produce a coordination design: a structured document that says which patterns fit a given task, which roles the agents play, where the boundaries between them fall, and why the cost is justified by the benefit. The medium project supplies the setting, and the deliverable is the design document itself, written by each student during the session.

The practical principles that decide whether explicit orchestration actually works are covered in depth. The first is teaching the orchestrator to delegate. Its instructions to each subagent must be concrete enough that the subagent has a clear objective, a defined output format, guidance on which tools and sources to use, and firm task boundaries; vague instructions breed duplicated work, gaps in coverage, and outputs that will not combine. The second is scaling effort to complexity, where explicit rules stop the orchestrator from spawning ten subagents for a job that needed one. The third treats tool design as a first-order concern, because the description an agent reads to understand a tool decides whether it uses the tool well or not at all.

The session then draws four patterns from the empirical literature. Role-Based Cooperation, assigning distinct responsibilities to each agent, is the dominant pattern, present in nearly half of studied systems and the main route to maintainability through modularity. Self-Reflection has an agent examine its own output before returning it, cutting defects without a separate reviewer. Cross-Reflection has agents critique each other, catching what self-reflection misses. Agent Evaluator adds an independent specialist that scores other agents' work against metrics. Together they turn orchestration from a hopeful arrangement into a design a student can defend.

### Module 16: Review and quality. Legacy onboarding.

Code review, this module argues, is the skill of reading and judging code you did not write, and in agentic engineering all significant code is exactly that. Agent output is foreign code. An inherited legacy system is foreign code. The task is the same in both: understand it well enough to trust it, extend it, or reject it, against the same standard.

The case for taking review seriously is made with numbers. Under rigorous audit, GPT-4's apparent fix rate on real bugs fell from 12.47% to 3.97%, and nearly 30% of patches that looked correct introduced regressions or proved wrong on a second look. That is the current baseline, and it is why review intensity has to rise with output volume rather than relax because the output looks fine.

The Merge-Readiness Pack gives the standard a shape: five criteria, each with explicit evidence. Functional completeness shown by end-to-end results, not passing tests alone. Sound verification, a test plan that probes real behaviour. SE hygiene, evidenced by static analysis, linting, and complexity checks. Rationale and communication, a human-readable account of approach and trade-offs. And full auditability, a frozen record tying intent, context, tools, and trajectory to the output. Satisfy all five and the pull request is merge-ready; fail one and it is not, however correct it appears.

The session names the recurring failure modes of agent code, from single-file patches that ignore the architecture to reasoning buried in trajectory files no one reads. The second half turns the same skill on legacy code, which is just foreign code from no recent session. The dependency-graph method maps the structure first, trusts verified leaf components as stable ground, and works upward from there. Tests are rebuilt from logical intent, never translated literally, because literal translation validates old assumptions instead of real behaviour.

### Module 17: Security and risk in agentic systems.

Security in agentic systems is an architectural problem, not a feature bolted on at the end. The session deals with the risks that belong specifically to systems where agents hold tools, permissions, and real reach into the world, risks that simply do not exist in non-agentic software and that standard security courses never raise.

Prompt injection is the foundational one. Malicious content sitting in the agent's environment, in a file it reads, a web page it fetches, a record it pulls from a database, carries instructions that the agent then treats as commands rather than data. The agent has no way to separate instruction from content, because in the context window both are only text. This is not a thought experiment. Researchers achieved remote code execution against Microsoft's Semantic Kernel with a single crafted prompt, no memory corruption and no browser exploit, just text the architecture could not tell apart from a legitimate command.

Blast radius is the concept that organises the defence. An agent with broad file access, shell execution, and network permissions can do harm at the scale of those permissions once compromised. The engineering answer is minimal footprint: grant only the permissions the task needs, prefer reversible actions, and bound the damage of any error by design instead of trusting the agent not to err.

Malicious MCP servers and supply-chain attacks extend the same logic to infrastructure. An MCP server that poses as a useful tool while exfiltrating data through its call parameters, or a compromised dependency in the tool ecosystem, is an attack surface that grows with every integration added. The session closes on the OWASP Top 10 for Agentic Applications, published in December 2025 as the first industry-standard framework built for these systems, and uses it as the working checklist of what defenders actually have to cover.

### Module 18: Entrepreneurship in the age of AI coding.

This module is a careful look at how startup economics have shifted, driven by two mechanisms that amplify each other. The first is compression. Agentic coding cuts the cost and the timeline of building, so projects that were never economically viable become viable, and a small team can build and iterate at a pace that used to demand a large engineering organisation. The second is cognification, which opens product surfaces that did not exist before: legal platforms that automate document review, fintech systems that reason over transactions, operations teams building their own internal tools, all in domains where software was once too slow or too costly to be the answer.

The case studies are examined analytically, not admired. TELUS removing 500,000 hours of work through AI-augmented workflows. Zapier reaching 89% AI adoption across the company. A lawyer with no coding background building a Claude-powered review workflow that cut turnaround from days to hours. For each one students name the precise mechanism of value creation, the organisational condition that allowed it, and the risk that was either managed or ignored. The analytical frame is the lesson: not "look what AI can do" but "what made this work here, and what would have to be true for it to work somewhere else."

The new bottlenecks matter as much as the old constraints that fell. With agentic tools, development cost and timeline are no longer the founder's main obstacle. Distribution is. So is real customer understanding, judgement about what is worth building, and the ability to iterate fast on product decisions. The session ends by turning the analysis on the students' own capstone with one demanding question: is this a feature, a product, or a company, and what would have to be true for each of those answers to be the right one?

### Module 19: Job search in the age of AI coding.

This module analyses how the developer job market is restructuring, and it does so for one specific reader: a student who has just finished this course. It does not offer general job-hunting advice. It offers a reading of what is changing and of how the skills built here place a practitioner inside that change.

The shift is described with care. Demand is moving toward developers who can orchestrate agents, evaluate output, design systems, and hold quality at scale, and away from pure implementation roles that agents are steadily absorbing. The movement is neither uniform across the market nor instantaneous, which means a student has to read signals rather than apply a single rule. So the session teaches reading. How to scan a job description for genuine AI adoption against performative mention. What the presence or absence of particular tools reveals about how a team actually works. How to gauge an employer's adoption maturity instead of trusting its brand.

The second half turns to self-presentation. The session covers how to put agentic engineering experience into a CV and an interview: what to claim, how to demonstrate it rather than assert it, and which questions to ask an employer to find out whether a role will grow the skills that compound or quietly let them erode.

The exercise is concrete and individual. Each student receives three real, recent job descriptions, audits them against the framework from the first half of the session, and then writes a single paragraph positioning their own ASE skills for the strongest of the three. Nothing here is generic. The student leaves with a way to judge an employer, a way to describe themselves honestly, and a clear sense of which roles will keep them on the side of the work that is growing in value rather than shrinking.
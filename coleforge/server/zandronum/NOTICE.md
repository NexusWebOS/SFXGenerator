# Zandronum networking in ColeForge

`huffman.js`, `protocol.js` and `client.js` let ColeForge list, query and join
[Zandronum](https://zandronum.com/) servers: the master-server list, the launcher protocol
(server name, map, players, WADs, game mode…) and LAN broadcasts. They were written from
Zandronum's own source code, read at <https://github.com/TorrSamaho/zandronum>
(the canonical repository is <https://foss.heptapod.net/zandronum/zandronum-stable>):

| ColeForge file | Zandronum source it follows |
| --- | --- |
| `huffman.js` | `src/huffman/huffman.cpp`, `huffcodec.cpp`, `bitwriter.cpp` (tree data copied verbatim) |
| `protocol.js` | `src/sv_master.cpp` (reply layout), `src/browser.cpp` (reply parsing, master list), `src/cl_main.cpp`, `src/sv_main.cpp`, `src/sv_main.h` (SQF flags), `src/networkshared.h` (challenges, ports), `src/gamemode_enums.h` |
| `client.js` | `src/sv_master.cpp` `SERVER_MASTER_Broadcast` (LAN broadcasts to UDP 15101) |

No Zandronum binaries or game data are included. `coleforge/core/windows/get-zandronum.ps1`
downloads the official Windows build from zandronum.com.

## Huffman codec: MIT License

    Copyright 2009 Timothy Landers
    email: code.vortexcortex@gmail.com

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

## Launcher / master protocol: Skulltag / Zandronum License

    Skulltag Source
    Copyright (C) 2003 Brad Carney
    Copyright (C) 2007-2012 Skulltag Development Team
    Copyright (C) 2012 Benjamin Berkels
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice,
       this list of conditions and the following disclaimer.
    2. Redistributions in binary form must reproduce the above copyright notice,
       this list of conditions and the following disclaimer in the documentation
       and/or other materials provided with the distribution.
    3. Neither the name of the Skulltag Development Team nor the names of its
       contributors may be used to endorse or promote products derived from this
       software without specific prior written permission.
    4. Redistributions in any form must be accompanied by information on how to
       obtain complete source code for the software and any accompanying
       software that uses the software. The source code must either be included
       in the distribution or be available for no more than the cost of
       distribution plus a nominal fee, and must be freely redistributable
       under reasonable conditions. For an executable file, complete source
       code means the source code for all modules it contains. It does not
       include source code for modules or files that typically accompany the
       major components of the operating system on which the executable file
       runs.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
    CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
    SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
    INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
    CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
    ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
    POSSIBILITY OF SUCH DAMAGE.

Clause 4: the complete ColeForge source is in this repository, and Zandronum's is at the
links above.

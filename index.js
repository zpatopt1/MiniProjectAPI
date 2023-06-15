const express = require('express');
const app = express();
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');

const config = {
  user: 'admin',
  password: '12345678',
  server: 'adopv.cz6lpenr9ll4.eu-north-1.rds.amazonaws.com',
  database: 'ADoP',
  options: {
    encrypt: true,
    trustServerCertificate: true // Disable certificate verification
  }
};

// Middleware para fazer o parse do corpo da requisição como JSON
app.use(bodyParser.json());
//Config cors
app.use(cors());

// POST endpoint para adicionar jogadores
app.post('/players', (req, res) => {
    const { id_clube, nome, ativo, dt_nasc } = req.body;
  
    console.log(req.body); // Exibir o conteúdo do req.body no console
  
    sql.connect(config)
      .then(pool => {
        const query = `
          INSERT INTO atleta (id_clube, nome, ativo, dt_nasc)
          VALUES (${id_clube}, '${nome}', ${ativo}, '${dt_nasc}');
        `;
  
        return pool.request().query(query);
      })
      .then(result => {
        res.json({ message: 'Jogador adicionado com sucesso' });
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
// API endpoint para atualizar um jogador
app.put('/players/:cc_atleta', (req, res) => {
  const cc_atleta = req.params.cc_atleta;
  const { id_clube, nome, ativo, dt_nasc } = req.body;

  sql.connect(config)
    .then(pool => {
      const query = `
        UPDATE atleta
        SET id_clube = ${id_clube}, nome = '${nome}', ativo = ${ativo}, dt_nasc = '${dt_nasc}'
        WHERE cc_atleta = ${cc_atleta};
      `;

      return pool.request().query(query);
    })
    .then(result => {
      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Jogador não encontrado' });
      }

      res.json({ message: 'Jogador atualizado com sucesso' });
    })
    .catch(err => {
      console.error('Erro:', err);
      res.status(500).json({ error: 'Ocorreu um erro' });
    });
});


//API endpoint para remover um jogador
app.delete('/players/:id', (req, res) => {
    const { id } = req.params;

    console.log(req.params);
  
    sql.connect(config)
      .then(pool => {
        const query = `
          DELETE FROM atleta
          WHERE cc_atleta = ${id};
        `;
  
        return pool.request().query(query);
      })
      .then(result => {
        res.json({ message: 'Jogador removido com sucesso' });
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });

//DASHBOARD
// Rota para obter o dashboard
app.get('/dashboard', (req, res) => {
  // Objeto para armazenar os dados do dashboard
  const dashboardData = {};

  // Consulta para obter a quantidade de jogadores registrados por clube
  const query1 = `
    SELECT c.nome, COUNT(t.id_clube) AS quantidade_jogadores
    FROM clube AS c
    JOIN atleta AS t ON c.id_clube = t.id_clube
    GROUP BY c.nome;
  `;

  // Consulta para obter os top 5 jogadores com mais registros de controle por competição
  const query2 = `
  SELECT ca.nome AS nome_campeonato, a.nome AS nome_atleta, COUNT(c.id_controlo) AS total_registros
  FROM atleta a
  JOIN controlo c ON a.CC_atleta = c.CC_atleta
  JOIN campeonato ca ON c.id_campeonato = ca.id_campeonato
  GROUP BY ca.nome, a.nome
  ORDER BY ca.nome, total_registros DESC;
  `;

  // Consulta para obter os top 10 jogadores com menos registros de controle por equipe
  const query3 = `
    SELECT TOP 10 a.nome AS nome_atleta, e.nome AS nome_equipa, COUNT(c.id_controlo) AS num_testes
    FROM atleta a
    JOIN controlo c ON a.CC_atleta = c.CC_atleta
    JOIN clube cl ON a.id_clube = cl.id_clube
    JOIN equipa e ON cl.id_equipa = e.id_equipa
    GROUP BY a.nome, e.nome
    HAVING COUNT(c.id_controlo) > 0
    ORDER BY num_testes ASC;
  `;

  // Consulta para obter o número de jogadores que efetuaram controle antidoping nos últimos 30 dias por clube
  const query4 = `
    SELECT cl.nome AS nome_clube, COUNT(DISTINCT a.CC_atleta) AS num_jogadores
    FROM clube AS cl
    JOIN atleta AS a ON cl.id_clube = a.id_clube
    JOIN controlo AS c ON a.CC_atleta = c.CC_atleta
    WHERE c.dt_controlo >= DATEADD(DAY, -30, GETDATE())
    GROUP BY cl.nome;
  `;

  // Consulta para obter o número de jogadores que não foram sujeitos a controle antidoping nos últimos 30 dias por clube
  const query5 = `
    SELECT COUNT(DISTINCT a.CC_atleta) AS num_jogadores_sem_controlo
    FROM atleta AS a
    LEFT JOIN controlo AS c ON a.CC_atleta = c.CC_atleta AND c.dt_controlo >= DATEADD(DAY, -30, GETDATE())
    WHERE c.id_controlo IS NULL;
  `;

  sql.connect(config)
    .then(pool => {
      // Executar as consultas em paralelo
      return Promise.all([
        pool.request().query(query1),
        pool.request().query(query2),
        pool.request().query(query3),
        pool.request().query(query4),
        pool.request().query(query5)
      ]);
    })
    .then(results => {
      // Extrair os resultados das consultas
      const result1 = results[0].recordset;
      const result2 = results[1].recordset;
      const result3 = results[2].recordset;
      const result4 = results[3].recordset;
      const result5 = results[4].recordset;

      // Armazenar os dados no objeto do dashboard
      dashboardData.jogadoresPorClube = result1;
      dashboardData.top5JogadoresPorCompeticao = result2;
      dashboardData.top10JogadoresPorEquipe = result3;
      dashboardData.jogadoresControloUltimos30DiasPorClube = result4;
      dashboardData.jogadoresSemControloUltimos30DiasPorClube = result5;

      // Retornar os dados do dashboard como resposta
      res.json(dashboardData);
    })
    .catch(err => {
      console.error('Erro:', err);
      res.status(500).json({ error: 'Ocorreu um erro' });
    });
});
  
//APP DESKTOP //possivel erro tested_players/competition
//Lista de jogadores testados numa dada competição (NOME DA COMPETIÇÃO) indicando a clínica e o profissional de saúde responsável pela colheita
//POSIVEL ERRO
app.get('/tested-players/competition', (req, res) => {
    const { competition } = req.params;
  
    const query = `
      SELECT a.nome AS nome_jogador, cl.nome AS nome_clinica, m.nome AS nome_profissional
      FROM atleta AS a
      JOIN controlo AS c ON a.CC_atleta = c.CC_atleta
      JOIN campeonato AS camp ON c.id_campeonato = camp.id_campeonato
      JOIN teste_dopagem AS t ON c.id_controlo = t.id_controlo
      JOIN clinica AS cl ON t.id_clinica = cl.id_clinica
      JOIN medico AS m ON cl.id_clinica = m.id_clinica
      WHERE camp.nome = '${competition}';
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
// Rota para obter a lista de jogadores que testaram positivo a substância dopante
app.get('/positive-players', (req, res) => {
    const query = `
    SELECT a.nome AS nome_jogador, cl.nome AS nome_clube, e.nome AS nome_equipa,
    td.dt_teste AS data_colheita, t.dt_teste AS data_teste, lab.nome AS laboratorio,
    s.nome AS substancia_positiva
    FROM atleta AS a
    JOIN controlo AS c ON a.CC_atleta = c.CC_atleta
    JOIN clube AS cl ON a.id_clube = cl.id_clube
    JOIN equipa AS e ON cl.id_equipa = e.id_equipa
    JOIN teste_dopagem AS td ON c.id_controlo = td.id_controlo
    JOIN resultado AS r ON td.id_teste = r.id_teste
    JOIN substanciasDoping AS s ON r.id_substancia = s.id_substancia
    JOIN laboratorio AS lab ON td.id_laboratorio = lab.id_laboratorio
    JOIN teste_dopagem AS t ON r.id_teste = t.id_teste
    WHERE r.resultado = 'Positivo';
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
// Lista de jogadores testados por competição e a quantidade e percentagem de testes de controlo positivos
app.get('/competition-tested-players', (req, res) => {
    const query = `
    SELECT camp.nome AS nome_competicao, COUNT(DISTINCT a.CC_atleta) AS quantidade_testados,
        SUM(CASE WHEN r.resultado = 'Positivo' THEN 1 ELSE 0 END) AS quantidade_positivos,
        (SUM(CASE WHEN r.resultado = 'Positivo' THEN 1 ELSE 0 END) / COUNT(DISTINCT a.CC_atleta)) * 100 AS percentagem_positivos
    FROM campeonato AS camp
    JOIN controlo AS c ON camp.id_campeonato = c.id_campeonato
    JOIN atleta AS a ON c.CC_atleta = a.CC_atleta
    JOIN teste_dopagem AS td ON c.id_controlo = td.id_controlo
    JOIN resultado AS r ON td.id_teste = r.id_teste
    GROUP BY camp.nome;
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });  
// Rota para obter a lista de laboratórios com a quantidade de testes realizados e a quantidade de testes positivos
app.get('/labs-tested', (req, res) => {
    const query = `
    SELECT lab.nome AS nome_laboratorio, COUNT(td.id_teste) AS quantidade_testes,
        SUM(CASE WHEN r.resultado = 'Positivo' THEN 1 ELSE 0 END) AS quantidade_positivos
    FROM laboratorio AS lab
    JOIN teste_dopagem AS td ON lab.id_laboratorio = td.id_laboratorio
    JOIN resultado AS r ON td.id_teste = r.id_teste
    GROUP BY lab.nome;

    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
// Rota para obter a lista das Top 10 substâncias com testes positivos
app.get('/top-positive-substances', (req, res) => {
    const query = `
    SELECT TOP 10 s.nome AS nome_substancia, COUNT(r.id_resultado) AS quantidade_positivos
    FROM resultado AS r
    JOIN substanciasDoping AS s ON r.id_substancia = s.id_substancia
    WHERE r.resultado = 'Positivo'
    GROUP BY s.nome
    ORDER BY COUNT(r.id_resultado) DESC;
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });

  //Rota para sorteio dos 5 jogadores que serão controlados na próxima semana 
  app.get('/random-players-control-next-week', (req, res) => {
    const query = `
    SELECT TOP 5 CC_atleta, nome
    FROM atleta
    WHERE ativo = 1
    ORDER BY NEWID();    
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
  app.get('/players-tested/:days', (req, res) => {
    const { days } = req.params;
  
    const query = `
      SELECT a.nome AS nome_jogador, s.nome AS nome_substancia, r.resultado AS resultado_teste
      FROM atleta AS a
      JOIN controlo AS c ON a.CC_atleta = c.CC_atleta
      JOIN teste_dopagem AS td ON c.id_controlo = td.id_controlo
      JOIN resultado AS r ON td.id_teste = r.id_teste
      JOIN substanciasDoping AS s ON r.id_substancia = s.id_substancia
      WHERE td.dt_teste >= DATEADD(DAY, -${days}, GETDATE()) AND td.dt_teste <= GETDATE();
    `;
  
    sql.connect(config)
      .then(pool => {
        return pool.request().query(query);
      })
      .then(result => {
        res.json(result.recordset);
      })
      .catch(err => {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Ocorreu um erro' });
      });
  });
  
        
// Iniciar o servidor
app.listen(3000, () => {
  console.log('Servidor ouvindo na porta 3000');
});
